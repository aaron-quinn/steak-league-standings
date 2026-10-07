const asList = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const idList = (value = '') => value.split(',').filter(Boolean);

export function parseRosterMoves(transactions, prefix) {
  const pickups = [];
  const departures = [];
  asList(transactions).forEach((move) => {
    const time = Number(move.timestamp) * 1000;
    const franchiseID = `${prefix}${move.franchise}`;

    if (['BBID_WAIVER', 'FREE_AGENT', 'WAIVER'].includes(move.type)) {
      // Won bids are "added|bid|dropped", free agent moves "added|dropped"
      const parts = (move.transaction || '').split('|');
      const bid = move.type === 'BBID_WAIVER';
      const cost = bid ? Number(parts[1]) || 0 : 0;
      // Older seasons store regular waiver claims in separate fields.
      const dropped = idList(
        move.type === 'WAIVER' ? move.dropped : bid ? parts[2] : parts[1],
      );
      const added = idList(move.type === 'WAIVER' ? move.added : parts[0]);
      added.forEach((playerID, index) =>
        pickups.push({
          franchiseID,
          playerID,
          time,
          bid,
          // One bid, however many players it brings in
          cost: index === 0 ? cost : 0,
          dropped,
        }),
      );
      dropped.forEach((playerID) =>
        departures.push({ franchiseID, playerID, time, drop: true }),
      );
    } else if (move.type === 'TRADE') {
      idList(move.franchise1_gave_up).forEach((playerID) =>
        departures.push({ franchiseID, playerID, time, drop: false }),
      );
      idList(move.franchise2_gave_up).forEach((playerID) =>
        departures.push({
          franchiseID: `${prefix}${move.franchise2}`,
          playerID,
          time,
          drop: false,
        }),
      );
    }
  });

  const byTime = (a, b) => a.time - b.time;
  return { pickups: pickups.sort(byTime), departures: departures.sort(byTime) };
}
