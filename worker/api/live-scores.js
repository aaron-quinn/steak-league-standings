import getData from './get-data.js';
import { getPlayerMap } from './players.js';

const LIVE_SCORES_CACHE_SECONDS = 30;
const SCHEDULE_CACHE_SECONDS = 60 * 60 * 6;

// Creating a formatter is far more expensive than using one, and toLocaleString
// creates a new one on every call
const gameTimeFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  hour: 'numeric',
  minute: 'numeric',
  timeZone: 'America/New_York',
  timeZoneName: 'short',
});

export default async function getLiveScores({ season, leagueID, prefix = '' }) {
  try {
    // Get the live scores from the MFL API
    const liveScoresURL = `/${season}/export?TYPE=liveScoring&L=${leagueID}&JSON=1`;

    const [liveScoresResponse, playerMap] = await Promise.all([
      getData(liveScoresURL, { cacheSeconds: LIVE_SCORES_CACHE_SECONDS }),
      getPlayerMap({ season, leagueID }),
    ]);

    // MFL has no live scoring in the offseason and returns an error instead
    if (!liveScoresResponse.liveScoring) {
      return {
        week: null,
        scores: {},
        matchups: [],
        unavailable:
          liveScoresResponse.error?.$t || 'Live scoring is not available yet',
      };
    }

    const week = liveScoresResponse.liveScoring.week;

    const scheduleURL = `/${season}/export?TYPE=nflSchedule&W=${week}&JSON=1`;
    const scheduleResponse = await getData(scheduleURL, {
      cacheSeconds: SCHEDULE_CACHE_SECONDS,
    });

    const teamSchedule = {};
    if (scheduleResponse.nflSchedule && scheduleResponse.nflSchedule.matchup) {
      scheduleResponse.nflSchedule.matchup.forEach((matchup) => {
        const kickoff = parseInt(matchup.kickoff, 10);
        matchup.team.forEach((t) => {
          teamSchedule[t.id] = kickoff;
        });
      });
    }

    const matchups = liveScoresResponse.liveScoring.matchup;
    const teamsOnBye = liveScoresResponse.liveScoring.franchise;

    const liveScores = {};

    const processFranchise = (team) => {
      const { id, score, players: teamPlayersData } = team;
      const teamPlayers = teamPlayersData?.player;

      let yetToPlay = 0;
      let inProgress = 0;
      const yetToPlayNames = [];
      const inProgressNames = [];

      const playersList = Array.isArray(teamPlayers)
        ? teamPlayers
        : teamPlayers
        ? [teamPlayers]
        : [];

      playersList.forEach((player) => {
        if (player.status === 'starter') {
          const remaining = parseInt(player.gameSecondsRemaining, 10);
          // Only players still to finish are reported, so skip the rest
          // before doing any per-player work
          if (!(remaining > 0)) {
            return;
          }

          const mflPlayer = playerMap.get(player.id);
          const playerInfo = mflPlayer
            ? {
                name: mflPlayer.name,
                position: mflPlayer.position,
                team: mflPlayer.team,
              }
            : {
                name: player.id,
                position: '',
              };

          let gameTime = '';
          if (playerInfo.team && teamSchedule[playerInfo.team]) {
            const kickoff = teamSchedule[playerInfo.team];
            gameTime = gameTimeFormat.format(new Date(kickoff * 1000));
          }

          const playerResult = {
            ...playerInfo,
            gameTime,
          };

          if (remaining === 3600) {
            yetToPlay++;
            yetToPlayNames.push(playerResult);
          } else if (remaining > 0) {
            inProgress++;
            inProgressNames.push(playerResult);
          }
        }
      });

      liveScores[`${prefix}${id}`] = {
        score,
        yetToPlay,
        inProgress,
        yetToPlayNames,
        inProgressNames,
      };
    };

    (matchups || []).forEach((matchup) => {
      const matchupTeams = matchup.franchise;
      matchupTeams.forEach(processFranchise);
    });

    if (teamsOnBye) {
      const byeTeams = Array.isArray(teamsOnBye) ? teamsOnBye : [teamsOnBye];
      byeTeams.forEach(processFranchise);
    }

    return {
      scores: liveScores,
      matchups: matchups || [],
      week: parseInt(week, 10),
    };
  } catch (error) {
    return { error };
  }
}
