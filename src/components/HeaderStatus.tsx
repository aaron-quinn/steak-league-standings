import { useEffect, useState } from 'react';

interface Props {
  // The week in progress, as reported by the /week endpoint
  week?: number;
  // Official standings only cover completed weeks
  official?: boolean;
  // When the data on screen was fetched, in ms since the epoch
  updatedAt?: number;
  // Games are underway right now
  inProgress?: boolean;
}

function timeAgo(ms: number, now: number) {
  const minutes = Math.floor((now - ms) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Re-renders every 30 seconds so relative times stay current
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export default function HeaderStatus({
  week,
  official,
  updatedAt,
  inProgress,
}: Props) {
  const now = useNow();

  const weekLabel = week
    ? official
      ? week > 1
        ? `Through week ${week - 1}`
        : null
      : `Week ${week}`
    : null;
  const showUpdated = !official && Boolean(updatedAt);

  if (!weekLabel && !showUpdated) return null;

  return (
    <div className="ml-auto hidden lg:flex h-10 items-center gap-2 text-xs text-gray-500 tabular-nums antialiased">
      {inProgress && (
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_1px] shadow-emerald-400/50"
        />
      )}
      {inProgress && <span className="sr-only">Games in progress.</span>}
      {weekLabel && <span className="text-gray-300">{weekLabel}</span>}
      {weekLabel && showUpdated && (
        <span aria-hidden="true" className="text-gray-700">
          ·
        </span>
      )}
      {showUpdated && updatedAt && (
        <span>
          Updated{' '}
          <time
            dateTime={new Date(updatedAt).toISOString()}
            title={new Date(updatedAt).toLocaleString()}
          >
            {timeAgo(updatedAt, now)}
          </time>
        </span>
      )}
    </div>
  );
}
