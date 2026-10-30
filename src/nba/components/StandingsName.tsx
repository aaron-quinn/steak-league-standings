import { lastName } from '../lib/standings';

export default function StandingsName({ name, hasOwner }: { name: string; hasOwner: boolean }) {
  return (
    <span aria-label={name} title={name}>
      <span className="nba-name-full" aria-hidden="true">{name}</span>
      <span className="nba-name-mobile" aria-hidden="true">{hasOwner ? lastName(name) : name}</span>
    </span>
  );
}
