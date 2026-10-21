import { useEffect, useState } from 'react';
import { useLeague, type NbaLeague } from '../lib/data';
import { dateOfDay, isFinished, shortDate } from '../lib/season';
import { hasStarted } from '../lib/standings';

export default function SeasonStatus({ league }: { league: NbaLeague }) {
  if (isFinished(league.season)) {
    return (
      <span>
        Final
        {league.cutoff &&
          ` · counted through ${shortDate(dateOfDay(league.opener, league.lastDay))}`}
      </span>
    );
  }
  if (!hasStarted(league)) {
    return <span>Tips off {shortDate(dateOfDay(league.opener, 1))}</span>;
  }
  return (
    <>
      <span className="nba-live-dot" aria-hidden="true" />
      <span>
        Live · {shortDate(dateOfDay(league.opener, league.latestDay))} ·{' '}
        <UpdatedAgo season={league.season} />
      </span>
    </>
  );
}

// "updated 40s ago", from when the page last heard from the Worker
function UpdatedAgo({ season }: { season: number }) {
  const { dataUpdatedAt } = useLeague(season);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.round((now - dataUpdatedAt) / 1000));
  const ago =
    seconds < 10
      ? 'just now'
      : seconds < 60
        ? `${Math.floor(seconds / 5) * 5}s ago`
        : `${Math.floor(seconds / 60)} min ago`;
  return <span title={new Date(dataUpdatedAt).toLocaleTimeString()}>updated {ago}</span>;
}
