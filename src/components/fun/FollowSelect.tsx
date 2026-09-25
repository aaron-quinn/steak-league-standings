import clsx from 'clsx';

interface Props {
  options: { id: string; name: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
}

// Picks one team to highlight across a Fun screen
export default function FollowSelect({
  options,
  value,
  onChange,
  className,
}: Props) {
  const sorted = [...options].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <label htmlFor="follow-team" className="text-xs sm:text-sm text-gray-500">
        Follow
      </label>
      <select
        id="follow-team"
        value={value ?? ''}
        disabled={sorted.length === 0}
        onChange={(event) => onChange(event.target.value || null)}
        className={clsx(
          'min-w-0 flex-1 rounded-md bg-gray-950 py-1 pl-2 pr-8 text-xs sm:text-sm font-medium focus:border-amber-300 focus:ring-amber-300 sm:max-w-[220px]',
          value
            ? 'border-amber-300/60 text-amber-200'
            : 'border-gray-800 text-gray-400',
        )}
      >
        <option value="">Everyone</option>
        {sorted.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Stop following"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-800 text-gray-500 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      )}
    </div>
  );
}
