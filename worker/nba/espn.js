// Turns ESPN's league responses into the small shapes the NBA pages use. The
// build script for past seasons and the Worker for the live one share these,
// so both produce the same data.
import { BENCH, GP, IR, MIN, STAT_IDS, ownerName } from './config.js';

// One day's scoreboard and transactions:
//   ESPN_LEAGUE(season)?view=mScoreboard&view=mTransactions2&scoringPeriodId=N
export const DAY_VIEWS = 'view=mScoreboard&view=mTransactions2';

// The league as a whole: teams and owners, their season totals, the auction
export const LEAGUE_VIEWS =
  'view=mTeam&view=mSettings&view=mStatus&view=mDraftDetail&view=mStandings';

const statLine = (stats) => STAT_IDS.map((id) => stats?.[id] ?? 0);
const counts = (slot) => slot !== BENCH && slot !== IR;

// {
//   day,
//   teams: { [teamID]: stat line summed over the active lineup },
//   players: [[teamID, playerID, slot, games, ...stat line]] for every
//            rostered player who played,
//   rosters: { [teamID]: every player on the team that day },
//   slots: { [playerID]: lineup slot } for every rostered player,
//   minutes: { [teamID]: minutes played by the active lineup },
//   tx: executed adds, drops and trades,
//   names: { [playerID]: name } for every rostered player
// }
// ESPN's accepted trades carry no players (it keeps them on a proposal it
// doesn't return), so trades are read from the rosters: see inferTrades in
// src/nba/lib/moves.ts.
export function compactDay(json, day) {
  const teams = {};
  const players = [];
  const rosters = {};
  const slots = {};
  const minutes = {};
  const names = {};
  const proTeams = {};
  for (const team of json.schedule?.[0]?.teams ?? []) {
    const total = STAT_IDS.map(() => 0);
    let played = 0;
    rosters[team.teamId] = [];
    for (const entry of team.rosterForCurrentScoringPeriod?.entries ?? []) {
      const player = entry.playerPoolEntry?.player;
      if (!player) continue;
      names[player.id] = player.fullName;
      if (Number.isInteger(player.proTeamId)) proTeams[player.id] = player.proTeamId;
      rosters[team.teamId].push(player.id);
      slots[player.id] = entry.lineupSlotId;
      const stats = player.stats?.find(
        (s) =>
          s.statSplitTypeId === 5 &&
          s.scoringPeriodId === day &&
          s.statSourceId === 0,
      )?.stats;
      const games = stats?.[GP] ?? 0;
      if (!games) continue;
      const line = statLine(stats);
      players.push([team.teamId, player.id, entry.lineupSlotId, games, ...line]);
      if (counts(entry.lineupSlotId)) {
        line.forEach((v, i) => (total[i] += v));
        played += stats[MIN] ?? 0;
      }
    }
    teams[team.teamId] = total;
    minutes[team.teamId] = Math.round(played);
  }

  const tx = (json.transactions ?? [])
    .filter(
      (t) =>
        t.status === 'EXECUTED' &&
        ['WAIVER', 'FREEAGENT', 'TRADE_ACCEPT'].includes(t.type),
    )
    .map((t) => ({
      type: t.type === 'TRADE_ACCEPT' ? 'TRADE' : t.type,
      team: t.teamId,
      bid: t.bidAmount ?? 0,
      at: t.processDate ?? t.proposedDate,
      items: (t.items ?? [])
        .filter((item) => ['ADD', 'DROP', 'TRADE'].includes(item.type))
        .map((item) => [item.type, item.playerId, item.fromTeamId, item.toTeamId]),
    }))
    .sort((a, b) => a.at - b.at);

  return { day, teams, players, rosters, slots, minutes, tx, names, proTeams };
}

// The NBA's games on one date, from ESPN's public scoreboard
//   https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=YYYYMMDD
// as [{ home, away, state: 'pre' | 'in' | 'post', detail, start }]. Team IDs
// are the same as the fantasy API's proTeamId.
export const SCOREBOARD = (isoDate) =>
  `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${isoDate.replaceAll('-', '')}`;

export function compactGames(json) {
  return (json.events ?? []).map((event) => {
    const teams = event.competitions?.[0]?.competitors ?? [];
    const side = (where) => Number(teams.find((t) => t.homeAway === where)?.team?.id ?? 0);
    return {
      home: side('home'),
      away: side('away'),
      state: event.status?.type?.state ?? 'pre',
      detail: event.status?.type?.shortDetail ?? '',
      start: event.date,
    };
  });
}

// {
//   season, finalDay, latestDay, budget,
//   teams: [{ id, name, abbrev, owner, totals, espn: { points, rank } }],
//   draft: [{ pick, team, playerID, price, keeper, nominator }]
// }
// `totals` are ESPN's live season totals (stat line order); `espn` is ESPN's
// own roto points and rank, which ignore any early cutoff.
export function compactLeague(json) {
  const members = json.members ?? [];
  return {
    season: json.seasonId,
    finalDay: json.status?.finalScoringPeriod ?? 0,
    latestDay: json.status?.latestScoringPeriod ?? 0,
    budget: json.settings?.draftSettings?.auctionBudget ?? 200,
    teams: (json.teams ?? []).map((team) => ({
      id: team.id,
      name: (team.name ?? `Team ${team.id}`).replace(/\s+/g, ' ').trim(),
      abbrev: team.abbrev ?? '',
      owner: ownerName(team, members),
      totals: statLine(team.valuesByStat),
      espn: { points: team.points ?? 0, rank: team.rankCalculatedFinal || 0 },
    })),
    draft: (json.draftDetail?.picks ?? [])
      .filter((pick) => pick.playerId > 0)
      .map((pick) => ({
        pick: pick.overallPickNumber,
        team: pick.teamId,
        playerID: pick.playerId,
        price: pick.bidAmount ?? 0,
        keeper: Boolean(pick.keeper),
        // The team that put the player up for auction
        nominator: pick.nominatingTeamId ?? 0,
      })),
  };
}
