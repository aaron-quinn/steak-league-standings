import clsx from 'clsx';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import BuildCard from '../components/BuildCard';
import BuildShape from '../components/BuildShape';
import SeasonStatus from '../components/SeasonStatus';
import Shell, { Loading, useSeason } from '../components/Shell';
import { useAllLeagues, useLeague } from '../lib/data';
import { formatPoints, ordinal, plural } from '../lib/format';
import { buildPeople, slugify, tendencies } from '../lib/people';
import { BUILD_LABEL, PUNT_REST, buildProfile } from '../lib/profile';
import { CATEGORIES } from '../lib/roto';
import { CURRENT_SEASON, dateOfDay, isFinished, shortDate } from '../lib/season';
import { buildStandings, hasStarted, personName } from '../lib/standings';

export default function BuildsPage() {
  const [season] = useSeason();
  const { data: league } = useLeague(season);
  const rows = useMemo(() => (league ? buildStandings(league.teams) : []), [league]);
  // ?view=managers, so the view survives a reload or a shared link
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'managers' ? 'managers' : 'seasons';
  const setView = (next: 'seasons' | 'managers') =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === 'managers') p.set('view', next);
        else p.delete('view');
        return p;
      },
      { replace: true },
    );

  return (
    <Shell
      title="Builds"
      status={view === 'seasons' ? league && <SeasonStatus league={league} /> : 'Every finished season'}
      tools={view === 'managers' ? <></> : undefined}
    >
      <div className="nba-grid">
        <section className="nba-panel" aria-label="Team builds">
          <div className="nba-panel-head">
            <h3 className="nba-panel-title">Category shapes</h3>
            <div className="nba-seg" role="group" aria-label="Builds view">
              <button aria-pressed={view === 'seasons'} onClick={() => setView('seasons')}>
                Season
              </button>
              <button aria-pressed={view === 'managers'} onClick={() => setView('managers')}>
                Managers
              </button>
            </div>
          </div>
          {view === 'managers' ? (
            <ManagerTendencies />
          ) : !league ? (
            <Loading label="Loading builds" />
          ) : !hasStarted(league) ? (
            <div className="nba-empty">
              <b>No games yet</b>
              Shapes fill in once the season tips off{' '}
              {shortDate(dateOfDay(league.opener, 1))}.
            </div>
          ) : (
            <>
              <ul className="nba-builds">
                {rows.map((row) => (
                  <BuildCard
                    key={row.team.id}
                    row={row}
                    teamCount={rows.length}
                    title={row.name}
                    to={row.team.owner ? `/nba/managers/${slugify(row.name)}` : undefined}
                    sub={`${ordinal(row.position)} · ${formatPoints(row.points)} roto points`}
                  />
                ))}
              </ul>
              <p className="nba-foot" style={{ margin: 0, padding: '0 12px 12px' }}>
                Each spoke is a category, further out for a better rank; the
                dashed ring is mid-table. Guard stats lean right, big-man stats
                left. Punting means bottom two in a category while the rest
                average mid-table or better.
                {!isFinished(season) && ' Shapes move with the standings.'}
              </p>
            </>
          )}
        </section>
        <PuntHistory />
      </div>
    </Shell>
  );
}

const labels = (indexes: number[]) => indexes.map((i) => CATEGORIES[i].label).join(', ');

// Each manager's habits: their average shape, usual build and favorite punts
function ManagerTendencies() {
  const { leagues, isPending } = useAllLeagues();
  const groups = useMemo(() => {
    if (isPending) return null;
    const current = leagues.find((l) => l.season === CURRENT_SEASON);
    const active = new Set(current?.teams.map(personName));
    const all = buildPeople(leagues).flatMap((person) => {
      const t = tendencies(person);
      return t ? [{ person, t }] : [];
    });
    return {
      active: all.filter(({ person }) => active.has(person.name)),
      // One season says little about habits
      past: all.filter(({ person, t }) => !active.has(person.name) && t.seasons > 1),
    };
  }, [leagues, isPending]);

  if (!groups) return <Loading label="Loading managers" />;
  const cards = (list: typeof groups.active) => (
    <ul className="nba-builds">
      {list.map(({ person, t }) => {
        return (
          <li key={person.slug} className="nba-build">
            <div className="nba-build-head">
              <Link to={`/nba/managers/${person.slug}`} className="who">
                {person.name}
              </Link>
              <span className="nba-faint">
                {plural(t.seasons, 'season')} · {person.ate}/{t.seasons} steaks
              </span>
            </div>
            <BuildShape
              shape={t.shape}
              zone="career"
              label={person.name}
              describe={(i) => ({ rank: `${ordinal(Math.round(t.ranks[i]))} on average` })}
            />
            <div className="nba-build-tags">
              {t.usual ? (
                <span className={clsx('nba-build-tag', t.usual)}>
                  {BUILD_LABEL[t.usual]} {t.builds[t.usual]}/{t.seasons}
                </span>
              ) : (
                <span className="nba-build-tag">Mixes it up</span>
              )}
              {t.punts.slice(0, 2).map((p) => (
                <span key={p.category} className="nba-build-tag punt">
                  Punted {CATEGORIES[p.category].label}
                  {p.times > 1 && ` ×${p.times}`}
                </span>
              ))}
            </div>
            <p className="nba-build-best">
              Best {labels([t.best])} · worst {labels([t.worst])}
            </p>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {cards(groups.active)}
      {groups.past.length > 0 && (
        <>
          <h4 className="nba-history-sub">Past managers</h4>
          {cards(groups.past)}
        </>
      )}
      <p className="nba-foot" style={{ margin: 0, padding: '0 12px 12px' }}>
        Each shape averages a manager&rsquo;s category ranks over every finished
        season. The build tag shows the one they used in at least half their
        seasons, and how often.
      </p>
    </>
  );
}

// Every finished season: which categories got punted, and whether it paid
function PuntHistory() {
  const { leagues, isPending } = useAllLeagues();
  const stats = useMemo(() => {
    if (isPending) return null;
    const punts = CATEGORIES.map(() => ({ teams: 0, ate: 0 }));
    const builds = { punted: { teams: 0, ate: 0 }, rest: { teams: 0, ate: 0 } };
    for (const league of leagues.filter((l) => isFinished(l.season))) {
      const rows = buildStandings(league.teams);
      for (const row of rows) {
        const { punts: p, shape } = buildProfile(
          row.categories.map((c) => c.points),
          rows.length,
        );
        const ate = row.zone === 'eater';
        // Compare like with like: punters are mid-table or better outside
        // their punt, so only count others who are too, leaving out their
        // own worst category
        const worst = Math.min(...shape);
        const others = (shape.reduce((a, b) => a + b, 0) - worst) / (shape.length - 1);
        const group = p.length ? builds.punted : others >= PUNT_REST ? builds.rest : null;
        if (group) {
          group.teams++;
          if (ate) group.ate++;
        }
        for (const i of p) {
          punts[i].teams++;
          if (ate) punts[i].ate++;
        }
      }
    }
    return {
      builds,
      punts: punts
        .map((p, i) => ({ ...p, i }))
        .filter((p) => p.teams > 0)
        .sort((a, b) => b.teams - a.teams || b.ate - a.ate),
    };
  }, [leagues, isPending]);

  const pct = (g: { teams: number; ate: number }) => Math.round((100 * g.ate) / g.teams);

  return (
    <section className="nba-panel" aria-label="Punting history">
      <div className="nba-panel-head">
        <h3 className="nba-panel-title">Does punting pay?</h3>
      </div>
      {!stats ? (
        <Loading />
      ) : (
        <>
          <dl className="nba-facts" style={{ padding: 12 }}>
            <div className="nba-fact">
              <dt>Punted</dt>
              <dd>
                <span className="big">{pct(stats.builds.punted)}%</span>
                <span className="small">
                  ate · {stats.builds.punted.ate} of {stats.builds.punted.teams}
                </span>
              </dd>
            </div>
            <div className="nba-fact">
              <dt>Didn&rsquo;t punt</dt>
              <dd>
                <span className="big">{pct(stats.builds.rest)}%</span>
                <span className="small">
                  ate · {stats.builds.rest.ate} of {stats.builds.rest.teams}
                </span>
              </dd>
            </div>
          </dl>
          <ul className="nba-rows">
            {stats.punts.map((p) => (
              <li key={p.i} className="nba-row">
                <span className="nba-row-main">
                  <span className="nba-row-title">Punted {CATEGORIES[p.i].label}</span>
                  <span className="nba-row-sub">
                    {p.teams} {p.teams === 1 ? 'team' : 'teams'} · {p.ate} ate
                  </span>
                </span>
                <span className="nba-row-value">
                  {pct(p)}%<small>ate</small>
                </span>
              </li>
            ))}
          </ul>
          <p className="nba-foot" style={{ margin: 0, padding: '10px 12px 12px' }}>
            Every finished season. &ldquo;Didn&rsquo;t punt&rdquo; counts only
            teams that were also mid-table or better outside their worst
            category, so both sides start level.
          </p>
        </>
      )}
    </section>
  );
}
