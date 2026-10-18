import type { NbaLeague } from '../lib/data';
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
        Live · {shortDate(dateOfDay(league.opener, league.latestDay))}
      </span>
    </>
  );
}
