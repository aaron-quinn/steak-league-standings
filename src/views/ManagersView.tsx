import clsx from 'clsx';
import { Link, useParams } from 'react-router-dom';
import PageShell from '@/components/PageShell';
import SectionLabel from '@/components/SectionLabel';
import MatchupsPlaceholder from '@/components/MatchupsPlaceholder';
import FunNav from '@/components/fun/FunNav';
import FinishHistogram from '@/components/fun/FinishHistogram';
import { zoneText } from '@/components/fun/zone-colors';
import { useCareers } from '@/hooks/useCareers';
import { useStandingsStore } from '@/stores/standings';
import { ordinal } from '@/utils/format-score';
import type { Career, CareerSeason } from '@/utils/manager-careers';

const card = 'rounded-lg border border-gray-800/60 bg-gray-950/30';

// Every manager since 2016, and one manager's career at /fun/managers/:slug
export default function ManagersView() {
  const { slug } = useParams();
  const currentYear = useStandingsStore((state) => state.year);
  const { careers, isError } = useCareers(currentYear);

  return (
    <PageShell>
      <FunNav />
      {isError ? (
        <MatchupsPlaceholder
          title="Couldn’t load the history"
          message="One of the seasons didn’t load. Try again in a minute."
        />
      ) : !careers ? (
        <div className="space-y-1.5" role="status" aria-label="Loading">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-lg bg-gray-950/60"
            />
          ))}
        </div>
      ) : slug ? (
        <ManagerCareer career={careers.find((c) => c.slug === slug)} />
      ) : (
        <ManagerList careers={careers} />
      )}
    </PageShell>
  );
}

const steakRate = (c: Career) =>
  c.ate + c.bought ? Math.round((100 * c.ate) / (c.ate + c.bought)) : null;

function ManagerList({ careers }: { careers: Career[] }) {
  const inPool = (c: Career) => c.seasons.some((s) => s.inPool);
  return (
    <>
      <SectionLabel tone="green">Steak managers since 2016</SectionLabel>
      <ManagerRows careers={careers.filter(inPool)} />
      <div className="mt-6">
        <SectionLabel>Never in the steak pool</SectionLabel>
        <ManagerRows
          careers={careers
            .filter((c) => !inPool(c))
            .sort(
              (a, b) => b.titles - a.titles || a.name.localeCompare(b.name),
            )}
        />
      </div>
    </>
  );
}

function ManagerRows({ careers }: { careers: Career[] }) {
  return (
    <ol className={clsx(card, 'divide-y divide-gray-800/40')}>
      {careers.map((c) => {
        const rate = steakRate(c);
        return (
          <li key={c.slug}>
            <Link
              to={`/fun/managers/${c.slug}`}
              className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-gray-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate text-sm sm:text-base font-medium text-gray-100">
                  {c.name}
                  {c.titles > 0 && (
                    <span className="text-xs" title={`${c.titles} titles`}>
                      {'🏆'.repeat(c.titles)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {c.seasons.length}{' '}
                  {c.seasons.length === 1 ? 'season' : 'seasons'}
                  {c.ate + c.bought > 0 &&
                    ` · ate ${c.ate} of ${c.ate + c.bought}`}
                </div>
              </div>
              {rate !== null && (
                <div className="text-right">
                  <div
                    className={clsx(
                      'font-mono text-base sm:text-lg font-semibold tabular-nums',
                      rate >= 50 ? 'text-emerald-400' : 'text-gray-300',
                    )}
                  >
                    {rate}%
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-gray-600">
                    steaks
                  </div>
                </div>
              )}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function Fact({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className={clsx(card, 'px-3 py-2.5')}>
      <div className="text-[10px] uppercase tracking-widest text-gray-500">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg sm:text-xl font-semibold text-gray-100 tabular-nums">
        {value}
      </div>
      <div className="mt-0.5 truncate text-[11px] text-gray-500">{detail}</div>
    </div>
  );
}

const resultLabel = (s: CareerSeason) =>
  !s.inPool
    ? 'Not in the steak pool'
    : s.ate === null
      ? `${ordinal(s.rank!)} of ${s.poolSize} after week ${s.weeksPlayed}`
      : `${ordinal(s.rank!)} of ${s.poolSize} · ${
          s.ate ? 'Ate 🥩' : s.zone === 'self-buyer' ? 'Bought own' : 'Bought'
        }`;

function ManagerCareer({ career }: { career: Career | undefined }) {
  if (!career) {
    return (
      <MatchupsPlaceholder
        title="Nobody by that name"
        message="That manager isn’t in the league history."
      />
    );
  }
  const finished = career.seasons.filter(
    (s) => s.finished && s.inPool && s.rank,
  );
  const best = finished.length
    ? Math.min(...finished.map((s) => s.rank!))
    : null;
  const bestYears = finished
    .filter((s) => s.rank === best)
    .map((s) => s.year)
    .sort();
  const champs = career.seasons.filter((s) => s.champion).map((s) => s.year);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-50">
          {career.name}
        </h2>
        <Link
          to="/fun/managers"
          className="text-xs sm:text-sm text-gray-500 underline-offset-2 hover:text-gray-200 hover:underline"
        >
          All managers
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact
          label="Steaks"
          value={`${career.ate}/${career.ate + career.bought}`}
          detail={'🥩'.repeat(career.ate) || 'None yet'}
        />
        <Fact
          label="Titles"
          value={String(career.titles)}
          detail={champs.length ? champs.join(', ') : 'Not yet'}
        />
        <Fact
          label="Best steak finish"
          value={best ? ordinal(best) : '–'}
          detail={best ? bestYears.join(', ') : 'No finished seasons'}
        />
        <Fact
          label="Best week"
          value={career.bestWeek ? career.bestWeek.score.toFixed(2) : '–'}
          detail={
            career.bestWeek
              ? `Week ${career.bestWeek.week}, ${career.bestWeek.year}`
              : 'No games yet'
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="lg:col-span-7" aria-label="Season by season">
          <SectionLabel>Season by season</SectionLabel>
          <ol className={clsx(card, 'divide-y divide-gray-800/40')}>
            {career.seasons.map((s) => (
              <li key={s.year} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-100">
                    {s.year} · {s.league}
                    {s.division && (
                      <span className="text-gray-500"> · {s.division}</span>
                    )}
                    {s.champion && (
                      <span className="ml-1.5" title="League champion">
                        🏆
                      </span>
                    )}
                  </div>
                  <div
                    className={clsx(
                      'text-xs',
                      s.ate === true ? 'text-emerald-400/80' : 'text-gray-500',
                    )}
                  >
                    {resultLabel(s)}
                    {s.record &&
                      ` · ${s.record.wins}–${s.record.losses}${s.record.ties ? `–${s.record.ties}` : ''}`}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={clsx(
                      'font-mono text-sm sm:text-base font-semibold tabular-nums',
                      s.zone ? zoneText[s.zone] : 'text-gray-300',
                    )}
                  >
                    {s.points.toFixed(1)}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-gray-600">
                    {s.finished ? 'points' : 'so far'}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="lg:col-span-5" aria-label="Steak finishes">
          <SectionLabel>Steak finishes</SectionLabel>
          <div className={clsx(card, 'p-3')}>
            {finished.length ? (
              <FinishHistogram seasons={finished} />
            ) : (
              <p className="text-sm text-gray-500">
                No finished steak seasons yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
