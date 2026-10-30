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
//   playerMinutes: { [playerID]: minutes } for rostered players who played,
//   playedFor: { [playerID]: NBA team } for rostered players who played,
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
  const playerMinutes = {};
  const playedFor = {};
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
      const split = player.stats?.find(
        (s) =>
          s.statSplitTypeId === 5 &&
          s.scoringPeriodId === day &&
          s.statSourceId === 0,
      );
      const stats = split?.stats;
      // The NBA team he played for that day: a past day's snapshot only has
      // his team as of when it was fetched, wrong if he was traded since
      if (Number.isInteger(split?.proTeamId)) playedFor[player.id] = split.proTeamId;
      const games = stats?.[GP] ?? 0;
      if (!games) continue;
      const line = statLine(stats);
      players.push([team.teamId, player.id, entry.lineupSlotId, games, ...line]);
      playerMinutes[player.id] = Math.round(stats[MIN] ?? 0);
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

  return {
    day,
    teams,
    players,
    rosters,
    slots,
    minutes,
    playerMinutes,
    playedFor,
    tx,
    names,
    proTeams,
  };
}

// Each team's rostered players with ESPN's season projections:
//   ESPN_LEAGUE(season)?view=mRoster
export const ROSTER_VIEWS = 'view=mRoster';

// { teams: [{ id, totals, players, missing }] }: each team's summed projection
// (stat line order) over its roster, leaving out IR slots, which don't count;
// `missing` is how many of those players ESPN has no projection for
export function compactProjections(json, season) {
  const id = `10${season}`;
  return {
    teams: (json.teams ?? []).map((team) => {
      const totals = STAT_IDS.map(() => 0);
      let players = 0;
      let missing = 0;
      for (const entry of team.roster?.entries ?? []) {
        if (entry.lineupSlotId === IR) continue;
        players++;
        const projection = entry.playerPoolEntry?.player?.stats?.find(
          (s) => s.id === id && s.statSourceId === 1,
        )?.stats;
        if (!projection) {
          missing++;
          continue;
        }
        statLine(projection).forEach((v, i) => (totals[i] += v));
      }
      return { id: team.id, totals, players, missing };
    }),
  };
}

// Every NBA player's season totals, for the per-game player comps. The league
// endpoint takes a filter (sent as the X-Fantasy-Filter header) that trims the
// response to the season totals; ESPN's public players endpoint ignores it and
// returns every game too, which only the build script can afford.
export const PLAYERS_VIEWS = 'view=kona_player_info';
export const PLAYERS_FILTER = (season) =>
  JSON.stringify({
    players: {
      limit: 2000,
      sortPercOwned: { sortAsc: false, sortPriority: 1 },
      filterStatsForTopScoringPeriodIds: { value: 1, additionalValue: [`00${season}`] },
    },
  });
export const PUBLIC_PLAYERS = (season) =>
  `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${season}/players?scoringPeriodId=0&view=kona_player_info`;

// { season, players: [[name, games, minutes, ...stat line]] } for everyone who
// played, from a list of ESPN player objects
export function compactPlayers(players, season) {
  const id = `00${season}`;
  const out = [];
  for (const player of players) {
    const stats = player?.stats?.find((s) => s.id === id)?.stats;
    const games = stats?.[GP] ?? 0;
    if (games > 0) out.push([player.fullName, games, stats[MIN] ?? 0, ...statLine(stats)]);
  }
  return { season, players: out };
}

// The NBA's whole season schedule, by fantasy scoring period (day)
export const SCHEDULE = (season) =>
  `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${season}?view=proTeamSchedules_wl`;

// { [NBA team id]: the days it plays }, src/nba/lib/schedule.ts NbaSchedule
export function compactSchedule(json) {
  const out = {};
  for (const team of json.settings?.proTeams ?? []) {
    const days = Object.keys(team.proGamesByScoringPeriod ?? {}).map(Number);
    if (days.length) out[team.id] = days.sort((a, b) => a - b);
  }
  return out;
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

// One NBA player's every game in a season, from ESPN's public game log
//   https://site.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/ID/gamelog?season=YYYY
// The athlete ID is the same as the fantasy API's player ID. ESPN's usual
// host for it, site.web.api.espn.com, answers 403 to Cloudflare Workers.
export const GAMELOG = (season, id) =>
  `https://site.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${id}/gamelog?season=${season}`;

// The game log's columns that make up the stat line, in stat line order
const LOG_COLUMNS = [
  'points',
  'totalRebounds',
  'assists',
  'threePointFieldGoalsMade-threePointFieldGoalsAttempted',
  'steals',
  'blocks',
  'fieldGoalsMade-fieldGoalsAttempted',
  'freeThrowsMade-freeThrowsAttempted',
];

// { games: [[date, team, '@' | 'vs', opponent, result, minutes, ...stat line]] }
// for every regular-season game played, oldest first. The date is the game's
// in Eastern time, which is the fantasy day it counted on.
export function compactGameLog(json) {
  const names = json.names ?? [];
  const at = (stats, name) => stats[names.indexOf(name)] ?? '0';
  const regular = (json.seasonTypes ?? []).filter((t) => /Regular Season/.test(t.displayName ?? ''));
  const games = [];
  for (const { stats, eventId } of regular.flatMap((t) => t.categories ?? []).flatMap((c) => c.events ?? [])) {
    const event = json.events?.[eventId];
    // ESPN files the All-Star Game under the regular season
    if (!event || !stats?.length || event.team?.isAllStar) continue;
    const line = LOG_COLUMNS.flatMap((name) => at(stats, name).split('-').map(Number));
    // 3PM-3PA splits into two; the stat line only counts makes
    line.splice(4, 1);
    games.push([
      new Date(event.gameDate).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
      event.team?.abbreviation ?? '',
      event.atVs ?? '',
      event.opponent?.abbreviation ?? '',
      event.gameResult ?? '',
      Number(at(stats, 'minutes')) || 0,
      ...line,
    ]);
  }
  return { games: games.sort((a, b) => a[0].localeCompare(b[0])) };
}
