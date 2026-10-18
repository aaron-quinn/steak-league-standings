// Same locally hosted RotoWire logos and ESPN team mapping as steak-nba.
const TEAMS: Record<number, string> = {
  1: 'ATL',
  2: 'BOS',
  3: 'NOP',
  4: 'CHI',
  5: 'CLE',
  6: 'DAL',
  7: 'DEN',
  8: 'DET',
  9: 'GSW',
  10: 'HOU',
  11: 'IND',
  12: 'LAC',
  13: 'LAL',
  14: 'MIA',
  15: 'MIL',
  16: 'MIN',
  17: 'BKN',
  18: 'NYK',
  19: 'ORL',
  20: 'PHI',
  21: 'PHX',
  22: 'POR',
  23: 'SAC',
  24: 'SAS',
  25: 'OKC',
  26: 'UTA',
  27: 'WAS',
  28: 'TOR',
  29: 'MEM',
  30: 'CHA',
};

export default function PlayerName({
  name,
  proTeam,
}: {
  name: string;
  proTeam?: number;
}) {
  const code = proTeam === undefined ? undefined : TEAMS[proTeam];
  return (
    <span className="nba-player-name">
      {code ? (
        <img
          className="nba-team-logo"
          src={`/nba-logos/${code}.png`}
          alt={code}
          title={`${code} · NBA team recorded for this season`}
          width={18}
          height={18}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span
          className="nba-team-logo nba-team-logo-empty"
          title={proTeam === 0 ? 'Free agent' : 'NBA team unavailable'}
          aria-label={proTeam === 0 ? 'Free agent' : 'NBA team unavailable'}
        />
      )}
      <span>{name}</span>
    </span>
  );
}
