import { ordinal } from '../lib/format';
import { seasonLabel } from '../lib/season';
import type { SteakZone } from '../lib/standings';

interface Finish {
  season: number;
  position: number;
  teamCount: number;
  zone: SteakZone;
}

const ZONE_LABEL: Record<SteakZone, string> = {
  eater: 'Ate',
  'self-buyer': 'Bought own',
  buyer: 'Bought',
};

// One column per place, one block per season stacked in it. League size has
// changed over the years, so each block takes the steak zone of its own season.
export default function FinishHistogram({ finishes }: { finishes: Finish[] }) {
  const places = Math.max(...finishes.map((f) => f.teamCount));
  const columns = Array.from({ length: places }, (_, i) =>
    finishes.filter((f) => f.position === i + 1).sort((a, b) => a.season - b.season),
  );
  // At least three blocks of headroom, so one-off finishes don't look squat
  const tallest = Math.max(3, ...columns.map((c) => c.length));
  const summary = columns
    .map((c, i) => (c.length ? `${ordinal(i + 1)} ×${c.length}` : null))
    .filter(Boolean)
    .join(', ');

  return (
    <figure className="nba-finishes" aria-label={`Finishes: ${summary}`}>
      <div className="plot" style={{ gridTemplateColumns: `repeat(${places}, 1fr)` }}>
        {columns.map((column, i) => (
          <div key={i} className="col" style={{ height: `${tallest * 27}px` }}>
            {column.map((f) => (
              <span
                key={f.season}
                className={`block ${f.zone}`}
                title={`${seasonLabel(f.season)}: ${ordinal(f.position)} of ${f.teamCount} · ${ZONE_LABEL[f.zone]}`}
              >
                {String(f.season).slice(2)}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="axis" style={{ gridTemplateColumns: `repeat(${places}, 1fr)` }} aria-hidden="true">
        {columns.map((_, i) => (
          <span key={i}>{i + 1}</span>
        ))}
      </div>
      <figcaption className="nba-foot">
        Each block is a finished season, labeled by the year it ended:{' '}
        <span className="key eater">ate</span> · <span className="key self-buyer">bought own</span> ·{' '}
        <span className="key buyer">bought</span>
      </figcaption>
    </figure>
  );
}
