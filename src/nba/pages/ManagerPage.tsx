import PlayerName from '../components/PlayerName';
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Link, useParams } from 'react-router-dom';
import RowValue from '../components/RowValue';
import Shell, { Loading } from '../components/Shell';
import { useAllLeagues } from '../lib/data';
import { formatPoints, ordinal } from '../lib/format';
import BuildCard from '../components/BuildCard';
import FinishHistogram from '../components/FinishHistogram';
import { buildPeople, categoryProfile, type PersonSeason } from '../lib/people';
import { CATEGORIES } from '../lib/roto';
import { seasonLabel } from '../lib/season';

const ZONE_LABEL = { eater: 'Ate 🥩', 'self-buyer': 'Bought own', buyer: 'Bought' };

export default function ManagerPage() {
  const { slug } = useParams();
  const { leagues, isPending } = useAllLeagues();
  const people = useMemo(() => (isPending ? [] : buildPeople(leagues)), [leagues, isPending]);
  const person = people.find((p) => p.slug === slug);
  const profile = useMemo(() => (person ? categoryProfile(person) : []), [person]);

  if (isPending) {
    return (
      <Shell title="Manager" tools={<></>}>
        <Loading label="Loading" />
      </Shell>
    );
  }
  if (!person) {
    return (
      <Shell title="Manager" tools={<></>}>
        <div className="nba-panel">
          <div className="nba-empty">
            <b>Nobody by that name</b>
            <Link to="/nba/managers" className="nba-link">
              See every manager
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  const done = person.seasons.filter((s) => s.finished);
  const current = person.seasons.find((s) => !s.finished && s.started);
  const best = done.length ? Math.min(...done.map((s) => s.row.position)) : null;
  const picks = person.seasons.flatMap((s) => s.draft.map((p) => ({ ...p, season: s.season })));
  const priciest = [...picks].sort((a, b) => b.price - a.price).slice(0, 6);
  const valued = picks.filter((p) => p.surplus !== undefined);
  const bargains = [...valued].sort((a, b) => b.surplus! - a.surplus!).slice(0, 4);
  const busts = [...valued].sort((a, b) => a.surplus! - b.surplus!).slice(0, 4);
  const built = person.seasons.filter((s) => s.started);

  return (
    <Shell
      title={person.name}
      status={
        <span>
          {person.seasons.length} {person.seasons.length === 1 ? 'season' : 'seasons'} ·{' '}
          <Link to="/nba/managers" className="nba-link">
            All managers
          </Link>
        </span>
      }
      tools={<></>}
    >
      <dl className="nba-facts" style={{ marginBottom: 16 }}>
        <div className="nba-fact">
          <dt>Steaks</dt>
          <dd>
            <span className="big">
              {person.ate}/{person.ate + person.bought}
            </span>
            <span className="small">{'🥩'.repeat(person.ate) || 'None yet'}</span>
          </dd>
        </div>
        <div className="nba-fact">
          <dt>Titles</dt>
          <dd>
            <span className="big">{person.titles}</span>
            <span className="small">{'🏆'.repeat(person.titles) || 'Not yet'}</span>
          </dd>
        </div>
        <div className="nba-fact">
          <dt>Best finish</dt>
          <dd>
            <span className="big">{best ? ordinal(best) : '–'}</span>
            <span className="small">
              {best
                ? done.filter((s) => s.row.position === best).map((s) => seasonLabel(s.season)).join(', ')
                : 'No finished seasons'}
            </span>
          </dd>
        </div>
        <div className="nba-fact">
          <dt>Typical finish</dt>
          <dd>
            <span className="big">
              {done.length ? `Top ${Math.max(1, Math.round(100 * (1 - person.averageFinish)))}%` : '–'}
            </span>
            <span className="small">of the league, on average</span>
          </dd>
        </div>
      </dl>

      <div className="nba-grid">
        <div>
          <section className="nba-panel" aria-label="Seasons">
            <div className="nba-panel-head">
              <h3 className="nba-panel-title">Season by season</h3>
            </div>
            <ul className="nba-rows">
              {person.seasons.map((s) => (
                <li key={s.season}>
                  <Link
                    to={`/nba?season=${s.season}`}
                    className={clsx('nba-row nba-row-link', `zone-${s.finished ? s.row.zone : 'live'}`)}
                  >
                    <span className="nba-row-main">
                      <span className="nba-row-title">
                        {seasonLabel(s.season)} · {s.team.name}
                      </span>
                      <span className="nba-row-sub">
                        {s.finished
                          ? `${ordinal(s.row.position)} of ${s.teamCount} · ${ZONE_LABEL[s.row.zone]}`
                          : s === current
                            ? `In progress · ${ordinal(s.row.position)} of ${s.teamCount} now`
                            : 'Not started'}
                        {s.cutoff && ' · ended Mar 31'}
                      </span>
                    </span>
                    <span className="nba-row-value">
                      {s.finished || s === current ? formatPoints(s.row.points) : '–'}
                      <small>roto points</small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {priciest.length > 0 && (
            <section className="nba-panel" aria-label="Priciest buys" style={{ marginTop: 16 }}>
              <div className="nba-panel-head">
                <h3 className="nba-panel-title">Priciest buys</h3>
              </div>
              <ul className="nba-rows">
                {priciest.map((p) => (
                  <li key={`${p.season}-${p.pick}`} className="nba-row">
                    <span className="nba-row-main">
                      <span className="nba-row-title"><PlayerName name={p.player} proTeam={leagues.find((l) => l.season === p.season)?.proTeams?.[p.playerID]} /></span>
                      <span className="nba-row-sub">
                        ${p.price} · {seasonLabel(p.season)}
                        {p.points !== undefined && ` · ${p.games} games, ${p.points.toFixed(1)} roto points`}
                      </span>
                    </span>
                    {p.surplus !== undefined ? (
                      <RowValue value={p.surplus} label="vs price" sign />
                    ) : (
                      <span className="nba-row-value">${p.price}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div>
          {done.length > 0 && (
            <section className="nba-panel" aria-label="Finishes" style={{ marginBottom: 16 }}>
              <div className="nba-panel-head">
                <h3 className="nba-panel-title">Finishes</h3>
              </div>
              <FinishHistogram
                finishes={done.map((s) => ({
                  season: s.season,
                  position: s.row.position,
                  teamCount: s.teamCount,
                  zone: s.row.zone,
                }))}
              />
            </section>
          )}

          {profile.length > 0 && (
            <CategoryPanel
              key={person.slug}
              profile={profile}
              seasons={[...built].sort((a, b) => a.season - b.season)}
            />
          )}

          {bargains.length > 0 && (
            <section className="nba-panel" aria-label="Auction hits and misses" style={{ marginTop: 16 }}>
              <div className="nba-panel-head">
                <h3 className="nba-panel-title">Best and worst buys</h3>
              </div>
              <ul className="nba-rows">
                {[...bargains, ...busts.filter((b) => !bargains.includes(b))].map((p) => (
                  <li key={`${p.season}-${p.pick}`} className="nba-row">
                    <span className="nba-row-main">
                      <span className="nba-row-title"><PlayerName name={p.player} proTeam={leagues.find((l) => l.season === p.season)?.proTeams?.[p.playerID]} /></span>
                      <span className="nba-row-sub">
                        ${p.price} · {seasonLabel(p.season)} · {p.points!.toFixed(1)} roto points
                      </span>
                    </span>
                    <RowValue value={p.surplus!} label="vs price" sign />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {built.length > 0 && (
        <section className="nba-panel" aria-label="Builds by season" style={{ marginTop: 16 }}>
          <div className="nba-panel-head">
            <h3 className="nba-panel-title">Builds by season</h3>
          </div>
          <ul className="nba-builds">
            {built.map((s) => (
              <BuildCard
                key={s.season}
                row={s.row}
                teamCount={s.teamCount}
                title={seasonLabel(s.season)}
                to={`/nba/builds?season=${s.season}`}
                sub={`${ordinal(s.row.position)} of ${s.teamCount}${s.finished ? '' : ' now'}${s.team.name === person.name ? '' : ` · ${s.team.name}`}`}
              />
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}

// All-time by default; step back through each season they played. All-time
// sits after the newest season, like a final frame.
function CategoryPanel({ profile, seasons }: { profile: number[]; seasons: PersonSeason[] }) {
  const [index, setIndex] = useState(seasons.length);
  const season = seasons[index] as PersonSeason | undefined;
  const shape = season
    ? season.row.categories.map((c) => (c.points - 1) / (season.teamCount - 1))
    : profile;
  const ranked = shape.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const rank = (i: number) => season!.teamCount + 1 - season!.row.categories[i].points;

  return (
    <section className="nba-panel" aria-label="Category strengths">
      <div className="nba-panel-head">
        <h3 className="nba-panel-title">Categories</h3>
        <div className="nba-cat-step" role="group" aria-label="Season">
          <button aria-label="Previous season" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            ‹
          </button>
          <span aria-live="polite">{season ? seasonLabel(season.season) : 'All-time'}</span>
          <button
            aria-label={index === seasons.length - 1 ? 'All-time' : 'Next season'}
            disabled={index === seasons.length}
            onClick={() => setIndex(index + 1)}
          >
            ›
          </button>
        </div>
      </div>
      <ul className="nba-cat-bars">
        {CATEGORIES.map((c, i) => (
          <li
            key={c.key}
            title={
              season
                ? `${c.label}: ${c.format(season.row.categories[i].value)}, ${ordinal(Math.floor(rank(i)))} of ${season.teamCount}${Number.isInteger(rank(i)) ? '' : ' (tied)'}`
                : undefined
            }
          >
            <span className="label">{c.label}</span>
            <span className="nba-bar" aria-hidden="true">
              <span style={{ width: `${Math.round(shape[i] * 100)}%` }} />
            </span>
            <span className="value">
              {season ? ordinal(Math.floor(rank(i))) : Math.round(shape[i] * 100)}
            </span>
          </li>
        ))}
      </ul>
      <p className="nba-foot" style={{ margin: '0 12px 12px' }}>
        Best {CATEGORIES[ranked[0].i].label} · worst {CATEGORIES[ranked[ranked.length - 1].i].label}.{' '}
        {season
          ? `${ordinal(season.row.position)} of ${season.teamCount} overall${season.finished ? '' : ' so far'}. Each category's rank that season.`
          : 'Where they usually finish in each category: 100 is first every season, 0 is last.'}
      </p>
    </section>
  );
}
