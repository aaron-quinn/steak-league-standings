import clsx from 'clsx';

interface Props {
  teams: { id: number; name: string }[];
  value: number | null;
  onChange: (id: number | null) => void;
}

// Picks one team to highlight on a screen
export default function FollowSelect({ teams, value, onChange }: Props) {
  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <label className="nba-follow">
      Follow
      <select
        className={clsx({ on: value !== null })}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">Everyone</option>
        {sorted.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}

interface PeopleProps {
  names: string[];
  value: string | null;
  onChange: (name: string | null) => void;
}

// Follow one manager. A team slot's owner changes season to season, so the
// all-time lists follow the person rather than the slot.
export function FollowPeople({ names, value, onChange }: PeopleProps) {
  const sorted = [...new Set(names)].sort((a, b) => a.localeCompare(b));
  return (
    <label className="nba-follow">
      Follow
      <select
        className={clsx({ on: value !== null })}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">Everyone</option>
        {sorted.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
