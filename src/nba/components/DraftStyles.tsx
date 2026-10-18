import { Link } from 'react-router-dom';
import { signed } from './RowValue';
import { describeHabit, type BandRow, type DraftStyle, type Rebuy } from '../lib/draftStyle';
import { slugify } from '../lib/people';
import { seasonLabel } from '../lib/season';

export const HABIT_FOOT =
  'Only habits that held from one season to the next across the 2019–2026 auctions: $1–2 buys, early spending and nomination prices. Star spending, position mix and category taste didn’t hold. Shown for managers with 3+ auctions who sit well away from the league average, on the same side in at least 3 of every 4 seasons.';

function HabitList({ style }: { style: DraftStyle }) {
  return (
    <ul className="nba-habits">
      {style.habits.map((h) => {
        const d = describeHabit(h);
        return (
          <li key={h.key}>
            {d.text} <span className="hint">{d.hint}</span>
          </li>
        );
      })}
    </ul>
  );
}

const rebuyLine = (r: Rebuy) =>
  `×${r.buys.length} · last $${r.buys[0].price} in ${seasonLabel(r.buys[0].season)}`;

// The managers' habits, most habits first; links to each manager's page
export function DraftStylesPanel({ styles, title = 'Draft styles' }: { styles: DraftStyle[]; title?: string }) {
  const shown = styles.filter((s) => s.habits.length).sort((a, b) => b.habits.length - a.habits.length || a.owner.localeCompare(b.owner));
  if (!shown.length) return null;
  return (
    <section className="nba-panel" aria-label={title}>
      <div className="nba-panel-head">
        <h3 className="nba-panel-title">{title}</h3>
      </div>
      <ul className="nba-rows">
        {shown.map((s) => (
          <li key={s.owner} className="nba-row nba-style-row">
            <span className="nba-row-main">
              <Link to={`/nba/managers/${slugify(s.owner)}`} className="nba-row-title nba-link">
                {s.owner}
              </Link>
              <HabitList style={s} />
            </span>
          </li>
        ))}
      </ul>
      <p className="nba-foot nba-panel-foot">{HABIT_FOOT}</p>
    </section>
  );
}

// One manager's habits and repeat buys, for their page
export function ManagerStylePanel({ style }: { style: DraftStyle }) {
  const rebuys = style.rebuys.slice(0, 6);
  return (
    <section className="nba-panel" aria-label="Draft style">
      <div className="nba-panel-head">
        <h3 className="nba-panel-title">Draft style</h3>
      </div>
      <div className="nba-panel-body">
        {style.habits.length ? (
          <HabitList style={style} />
        ) : (
          <p className="nba-foot" style={{ margin: 0 }}>
            {style.auctions < 3 ? 'Too few auctions to call a habit yet.' : 'No strong habits: drafts like the league average.'}
          </p>
        )}
      </div>
      {rebuys.length > 0 && (
        <>
          <p className="nba-section-label" style={{ margin: '0 12px 4px' }}>
            Bought again
          </p>
          <ul className="nba-rows">
            {rebuys.map((r) => (
              <li key={r.playerID} className="nba-row">
                <span className="nba-row-main">
                  <span className="nba-row-title">{r.player}</span>
                  <span className="nba-row-sub">{r.buys.map((b) => `${seasonLabel(b.season)} $${b.price}`).join(' · ')}</span>
                </span>
                <span className="nba-row-value">×{r.buys.length}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="nba-foot nba-panel-foot">{HABIT_FOOT}</p>
    </section>
  );
}

// The most re-bought manager–player pairs
export function LoyaltyPanel({ styles, limit = 12 }: { styles: DraftStyle[]; limit?: number }) {
  const pairs = styles
    .flatMap((s) => s.rebuys.map((r) => ({ owner: s.owner, r })))
    .sort((a, b) => b.r.buys.length - a.r.buys.length || b.r.buys[0].season - a.r.buys[0].season)
    .slice(0, limit);
  if (!pairs.length) return null;
  return (
    <section className="nba-panel" aria-label="Loyal buyers">
      <div className="nba-panel-head">
        <h3 className="nba-panel-title">Loyal buyers</h3>
      </div>
      <ul className="nba-rows">
        {pairs.map(({ owner, r }) => (
          <li key={`${owner}-${r.playerID}`} className="nba-row">
            <span className="nba-row-main">
              <span className="nba-row-title">{r.player}</span>
              <span className="nba-row-sub">
                {owner} · {rebuyLine(r)}
              </span>
            </span>
            <span className="nba-row-value">
              ×{r.buys.length}
              <small>auctions</small>
            </span>
          </li>
        ))}
      </ul>
      <p className="nba-foot nba-panel-foot">The same manager buying the same player in more than one auction. It happens more than chance would give.</p>
    </section>
  );
}

// What each price tier produced; all-time adds how many seasons it beat its price
export function PriceTiersPanel({ bands, beat }: { bands: BandRow[]; beat?: Map<string, { won: number; of: number }> }) {
  if (!bands.length) return null;
  return (
    <section className="nba-panel" aria-label="Price tiers">
      <div className="nba-panel-head">
        <h3 className="nba-panel-title">Price tiers</h3>
      </div>
      <div className="nba-scroll">
        <table className="nba-table nba-tiers">
          <thead>
            <tr>
              <th scope="col">Price</th>
              <th scope="col" className="num">Picks</th>
              <th scope="col" className="num">Roto pts</th>
              <th scope="col" className="num" title="Average roto points beyond what the price promised">Vs price</th>
              {beat && <th scope="col" className="num" title="Seasons the tier beat its price on average">Beat</th>}
            </tr>
          </thead>
          <tbody>
            {bands.map((b) => {
              const w = beat?.get(b.label);
              return (
                <tr key={b.label}>
                  <th scope="row">{b.label}</th>
                  <td className="num">{b.picks}</td>
                  <td className="num">{b.points.toFixed(1)}</td>
                  <td className={`num ${b.surplus >= 0.05 ? 'nba-good' : b.surplus <= -0.05 ? 'nba-bad' : ''}`}>{signed(b.surplus)}</td>
                  {beat && <td className="num">{w ? `${w.won}/${w.of}` : '–'}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="nba-foot nba-panel-foot">
        Roto points each pick added while on the team that bought it, against what picks at its price produced on average.
        Cheap picks often come out behind because they're dropped before they score.
      </p>
    </section>
  );
}
