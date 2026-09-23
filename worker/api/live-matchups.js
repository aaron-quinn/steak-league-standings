import getSchedule from './get-schedule.js';
import getData from './get-data.js';
import getPlayerList from './players.js';
import convertTeamCode from '../utils/convert-team-code.js';

export default async function getLiveMatchups({
  season,
  leagueID,
  prefix = '',
}) {
  try {
    // Get the live scores from the MFL API
    const liveScoresURL = `/${season}/export?TYPE=liveScoring&L=${leagueID}&DETAILS=1&JSON=1`;

    const [liveScoresResponse, players] = await Promise.all([
      getData(liveScoresURL),
      getPlayerList({ season, leagueID }),
    ]);

    // MFL returns an error object instead of liveScoring in the offseason
    // ("Live scoring not available until the season starts").
    if (!liveScoresResponse.liveScoring) {
      return {
        week: null,
        matchups: [],
        unavailable:
          liveScoresResponse.error?.$t || 'Live scoring is not available yet',
      };
    }

    const week = liveScoresResponse.liveScoring.week;

    const scheduleURL = `/apis/site/v2/sports/football/nfl/scoreboard?week=${week}`;
    const scheduleResponse = await getSchedule(scheduleURL);

    const teamSchedule = {};
    if (scheduleResponse.events) {
      scheduleResponse.events.forEach((matchup) => {
        const kickoff = Math.floor(Date.parse(matchup.date) / 1000);
        const quarterNumber = parseInt(matchup.status.period, 10);
        const quarterSecondsRemaining = parseInt(matchup.status.clock, 10);
        const gameSecondsRemaining =
          (4 - quarterNumber) * 900 + quarterSecondsRemaining;

        const gameSituation = matchup.competitions[0].situation;
        const inRedZone = gameSituation?.isRedZone;
        const possessionTeamID = gameSituation?.possession;
        const shortDownText = gameSituation?.downDistanceText;

        matchup.competitions[0].competitors.forEach((t, idx) => {
          const opponent = matchup.competitions[0].competitors[1 - idx];

          teamSchedule[convertTeamCode(t.team.abbreviation)] = {
            kickoff,
            gameSecondsRemaining,
            isHome: t.homeAway == 'home',
            score: t.score + '-' + opponent.score,
            hasPossession: t.id == possessionTeamID,
            inRedZone: t.id == possessionTeamID ? inRedZone : false,
            shortDownText: t.id == possessionTeamID ? shortDownText : null,
            opponentTeam: convertTeamCode(opponent.team.abbreviation),
          };
        });
      });
    }

    const playerMap = {};
    if (Array.isArray(players)) {
      players.forEach((player) => {
        playerMap[player.id] = {
          name: player.name,
          firstName: player.firstName,
          lastName: player.lastName,
          position: player.position,
          team: player.team,
        };
      });
    }

    const matchups = liveScoresResponse.liveScoring.matchup;
    const teamsOnBye = liveScoresResponse.liveScoring.franchise;

    const liveScores = {};
    const matchupData = [];

    const processFranchise = (team) => {
      const { id, score, players: teamPlayersData } = team;
      const teamPlayers = teamPlayersData?.player;

      let yetToPlay = 0;
      let inProgress = 0;
      let completed = 0;
      let benched = 0;
      const players = [];

      const playersList = Array.isArray(teamPlayers)
        ? teamPlayers
        : teamPlayers
        ? [teamPlayers]
        : [];

      playersList.forEach((player) => {
        const remaining = parseInt(player.gameSecondsRemaining, 10);
        const playerInfo = playerMap[player.id] || {
          name: player.id,
          position: '',
        };

        let gameInfo = null;
        if (playerInfo.team && teamSchedule[playerInfo.team]) {
          gameInfo = teamSchedule[playerInfo.team];
          gameInfo = {
            ...gameInfo,
            opponentDisplay: gameInfo.isHome
              ? `vs ${gameInfo.opponentTeam}`
              : `@ ${gameInfo.opponentTeam}`,
          };
        }

        let gameStatus = 'unknown';
        if (player.status === 'starter') {
          if (remaining === 3600) {
            yetToPlay++;
            gameStatus = 'yet-to-play';
          } else if (remaining > 0) {
            inProgress++;
            gameStatus = 'in-progress';
          } else {
            completed++;
            gameStatus = 'completed';
          }
        } else if (player.status === 'nonstarter') {
          if (remaining === 3600) {
            gameStatus = 'yet-to-play';
          } else if (remaining > 0) {
            gameStatus = 'in-progress';
          } else {
            gameStatus = 'completed';
          }
          benched++;
        }

        const playerResult = {
          mflPlayerID: player.id,
          ...playerInfo,
          score: player.score,
          isStarter: player.status === 'starter',
          gameStatus,
          gameInfo,
        };

        players.push(playerResult);
      });

      liveScores[`${prefix}${id}`] = {
        score,
        yetToPlay,
        inProgress,
        completed,
        players,
      };
    };

    (matchups || []).forEach((matchup) => {
      const matchupTeams = matchup.franchise;
      matchupTeams.forEach(processFranchise);

      const team1ID = matchupTeams[0]?.id ?? null;
      const team2ID = matchupTeams[1]?.id ?? null;

      let currentMatchup = [];
      if (team1ID !== null) {
        currentMatchup.push({
          franchiseID: `${prefix}${team1ID}`,
          ...liveScores[`${prefix}${team1ID}`],
        });
      }
      if (team2ID !== null) {
        currentMatchup.push({
          franchiseID: `${prefix}${team2ID}`,
          ...liveScores[`${prefix}${team2ID}`],
        });
      }

      matchupData.push(currentMatchup);
    });

    if (teamsOnBye) {
      const byeTeams = Array.isArray(teamsOnBye) ? teamsOnBye : [teamsOnBye];
      byeTeams.forEach(processFranchise);

      byeTeams.forEach((team) => {
        const teamID = team?.id ?? null;
        if (teamID !== null) {
          matchupData.push([
            {
              franchiseID: `${prefix}${teamID}`,
              ...liveScores[`${prefix}${teamID}`],
            },
          ]);
        }
      });
    }

    return {
      week,
      matchups: matchupData,
    };
  } catch (error) {
    return { error };
  }
}
