const asList = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const ids = (value = '') => value.split(',').filter(Boolean);
const round = (n) => Math.round(n * 100) / 100;

// Accepted trades only. Preserve non-player assets so they cannot silently
// turn into zero-value players and produce a misleading verdict.
export function parseTrades(transactions, league) {
  return asList(transactions)
    .filter((move) => move.type === 'TRADE')
    .map((move, index) => ({
      id: `${league}:${move.timestamp}:${index}`,
      league,
      time: Number(move.timestamp) * 1000,
      sides: [
        {
          franchiseID: `${league}${move.franchise}`,
          received: ids(move.franchise2_gave_up),
          sent: ids(move.franchise1_gave_up),
        },
        {
          franchiseID: `${league}${move.franchise2}`,
          received: ids(move.franchise1_gave_up),
          sent: ids(move.franchise2_gave_up),
        },
      ],
    }))
    .sort((a, b) => a.time - b.time);
}

// Dynamic programming over position groups and lineup size. Includes the
// league's flex limits; bench players are alternatives, not extra starters.
// Empty slots score zero, allowing injured/short rosters to be compared.
export function bestLineup(players, rules, positionOf) {
  let totals = new Map([[0, 0]]);
  for (const rule of asList(rules.position)) {
    const [min, max = min] = rule.limit.split('-').map(Number);
    const positions = rule.name.split('+');
    const scores = players
      .filter((p) => positions.includes(positionOf(p.id)))
      .map((p) => p.score)
      .sort((a, b) => b - a);
    const prefix = [0];
    for (let i = 0; i < max; i++) prefix.push(prefix[i] + (scores[i] ?? 0));
    const next = new Map();
    for (const [count, total] of totals) {
      for (let n = min; n <= max && count + n <= Number(rules.count); n++) {
        next.set(
          count + n,
          Math.max(next.get(count + n) ?? -Infinity, total + prefix[n]),
        );
      }
    }
    totals = next;
  }
  return totals.get(Number(rules.count)) ?? null;
}

export function valueTrades({
  trades,
  departures,
  weeks,
  starts,
  players,
  rules,
  scores,
}) {
  const schedule = new Map(starts.map((w) => [w.week, w]));
  const kickoffOf = (id, week) => {
    const nflWeek = schedule.get(week);
    if (!nflWeek) return null;
    // A bye/unscheduled player has no game to lock. Use the end of the
    // week so his observed zero-point roster stint can still be evaluated.
    return (
      nflWeek.kickoffs?.[players.get(id)?.team] ?? nflWeek.end ?? nflWeek.time
    );
  };
  const firstWeek = (id, time) =>
    starts.find((w) => kickoffOf(id, w.week) > time)?.week ?? Infinity;
  const positionOf = (id) => players.get(id)?.position ?? '';
  return trades.map((trade) => {
    const from = Math.min(
      ...trade.sides
        .flatMap((s) => [...s.received, ...s.sent])
        .map((id) => firstWeek(id, trade.time)),
    );
    const unsupported = trade.sides.some((s) =>
      [...s.received, ...s.sent].some((id) => !players.has(id)),
    );
    const sides = trade.sides.map((side) => {
      const received = side.received.map((id) => {
        const left = departures.find(
          (d) =>
            d.franchiseID === side.franchiseID &&
            d.playerID === id &&
            d.time > trade.time,
        );
        const games = weeks.flatMap(({ week, teams }) => {
          const kickoff = kickoffOf(id, week);
          if (
            kickoff === null ||
            kickoff <= trade.time ||
            (left && kickoff >= left.time)
          )
            return [];
          const player = teams[side.franchiseID]?.players.find(
            (p) => p.id === id,
          );
          return player
            ? [{ week, score: player.score, starter: player.starter }]
            : [];
        });
        const detail = players.get(id);
        return {
          id,
          name: detail?.name ?? id,
          position: detail?.position ?? '',
          team: detail?.team ?? '',
          supported: Boolean(detail),
          points: round(games.reduce((n, g) => n + g.score, 0)),
          started: round(
            games.reduce((n, g) => n + (g.starter ? g.score : 0), 0),
          ),
          games,
        };
      });
      const impact = [];
      for (const { week, teams } of weeks) {
        const roster = teams[side.franchiseID]?.players ?? [];
        const held = received.filter((p) =>
          p.games.some((g) => g.week === week),
        );
        const lockedReceived = received.filter(
          (p) =>
            kickoffOf(p.id, week) <= trade.time &&
            roster.some((r) => r.id === p.id),
        );
        // Do not restore sent players whose games were already locked, or
        // use a received player's pre-trade score as a new lineup option.
        const eligibleSent = side.sent.filter(
          (id) => kickoffOf(id, week) > trade.time,
        );
        if (
          !held.length &&
          !(lockedReceived.length && eligibleSent.length && week >= from)
        )
          continue;
        const available = roster.filter(
          (p) => !lockedReceived.some((r) => r.id === p.id),
        );
        const common = available.filter(
          (p) =>
            !held.some((h) => h.id === p.id) && !eligibleSent.includes(p.id),
        );
        const scoreMap = scores.get(week);
        const missing = eligibleSent.some((id) => !scoreMap?.has(id));
        const actual = bestLineup(available, rules, positionOf);
        const kept = bestLineup(
          [
            ...common,
            ...eligibleSent.map((id) => ({
              id,
              score: scoreMap?.get(id) ?? 0,
            })),
          ],
          rules,
          positionOf,
        );
        impact.push({
          week,
          withTrade: actual === null ? null : round(actual),
          withoutTrade:
            missing || unsupported || kept === null ? null : round(kept),
          lift:
            missing || unsupported || actual === null || kept === null
              ? null
              : round(actual - kept),
        });
      }
      return {
        franchiseID: side.franchiseID,
        received,
        points: round(received.reduce((n, p) => n + p.points, 0)),
        started: round(received.reduce((n, p) => n + p.started, 0)),
        lift:
          unsupported ||
          !weeks.some((w) => w.week >= from) ||
          impact.some((g) => g.lift === null)
            ? null
            : round(impact.reduce((n, g) => n + g.lift, 0)),
        impact,
      };
    });
    return {
      ...trade,
      week: Number.isFinite(from) ? from : null,
      unsupported,
      evaluated: weeks.some((w) => w.week >= from),
      sides,
    };
  });
}

export function weeklyRosterScores(weeks, league) {
  return new Map(
    weeks.map(({ week, teams }) => [
      week,
      new Map(
        Object.entries(teams)
          .filter(([id]) => id.startsWith(league))
          .flatMap(([, team]) => team.players.map((p) => [p.id, p.score])),
      ),
    ]),
  );
}
