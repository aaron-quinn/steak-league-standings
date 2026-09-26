import clsx from 'clsx';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import PageShell from '@/components/PageShell';
import SectionLabel from '@/components/SectionLabel';
import SegmentedTabs from '@/components/SegmentedTabs';
import MatchupsPlaceholder from '@/components/MatchupsPlaceholder';
import FunNav from '@/components/fun/FunNav';
import BumpChart from '@/components/fun/BumpChart';
import RankRace from '@/components/fun/RankRace';
import FollowSelect from '@/components/fun/FollowSelect';
import { zoneText } from '@/components/fun/zone-colors';
import { getWeeklyScores } from '@/api/fun';
import { useStandingsStore } from '@/stores/standings';
import { buildSteakSeason, getSeasonFacts } from '@/utils/steak-season';
import { getSteakZone } from '@/utils/steak-teams';

// Seasons with both leagues in the managers data
const FIRST_SEASON = 2016;

type Mode = 'chart' | 'race';

export default function SteakRaceView() {
  const currentYear = useStandingsStore((state) => state.year);
  const [searchParams, setSearchParams] = useSearchParams();

  const seasons = Array.from(
    { length: currentYear - FIRST_SEASON + 1 },
    (_, i) => currentYear - i,
  );
  const requestedSeason = Number(searchParams.get('season'));
  const year = seasons.includes(requestedSeason)
    ? requestedSeason
    : currentYear;
  const mode: Mode = searchParams.get('view') === 'race' ? 'race' : 'chart';

  const updateParams = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) =>
      value === null ? next.delete(key) : next.set(key, value),
    );
    setSearchParams(next, { replace: true });
  };

  const { data, isError, isPending } = useQuery({
    queryKey: ['weekly-scores', year],
    queryFn: () => getWeeklyScores(year),
  });

  const season = useMemo(
    () => (data ? buildSteakSeason(year, data) : null),
    [data, year],
  );
  const facts = useMemo(() => (season ? getSeasonFacts(season) : []), [season]);

  // The followed team lives in the URL by manager name, so it survives
  // switching views and seasons (franchise IDs change between seasons) and
  // can be shared
  const followName = searchParams.get('follow');
  const selected =
    season?.teams.find((team) => team.name === followName)?.id ?? null;
  const setSelected = (id: string | null) =>
    updateParams({
      follow: season?.teams.find((team) => team.id === id)?.name ?? null,
    });

  const last = season ? season.weeks.length - 1 : -1;
  const latest = season
    ? [...season.teams].sort((a, b) => a.ranks[last] - b.ranks[last])
    : [];

  return (
    <PageShell>
      <FunNav />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="w-40 sm:w-48">
          <SegmentedTabs
            label="Chart type"
            tabs={[
              { value: 'chart', label: 'Chart' },
              { value: 'race', label: 'Race' },
            ]}
            value={mode}
            onChange={(value) =>
              updateParams({ view: value === 'race' ? 'race' : null })
            }
          />
        </div>
        <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 sm:order-last">
          Season
          <select
            value={year}
            onChange={(event) => {
              updateParams({
                season:
                  Number(event.target.value) === currentYear
                    ? null
                    : event.target.value,
              });
            }}
            className="rounded-md border-gray-800 bg-gray-950 py-1 pl-2 pr-8 text-xs sm:text-sm font-medium text-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
          >
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        {/* Full width on its own row on phones */}
        <FollowSelect
          options={season?.teams ?? []}
          value={selected}
          onChange={setSelected}
          className="order-last w-full sm:order-none sm:w-auto sm:flex-1 sm:justify-end"
        />
      </div>

      {isError ? (
        <MatchupsPlaceholder
          title="Steak Race Unavailable"
          message="We were unable to load the weekly results. Please try again later."
        />
      ) : isPending || !season ? (
        <div
          role="status"
          aria-label="Loading"
          className="h-[420px] animate-pulse rounded-lg border border-gray-800/60 bg-gray-950/30"
        />
      ) : season.weeks.length === 0 ? (
        <MatchupsPlaceholder
          title="No Weeks Played Yet"
          message="The race starts once the first week of the season is in the books."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <SectionLabel tone="green">
              {`${year} Steak Race · ${
                season.weeks.length === 1
                  ? `Week ${season.weeks[0]}`
                  : `Weeks ${season.weeks[0]}–${season.weeks[last]}`
              }`}
            </SectionLabel>
            {mode === 'chart' ? (
              <BumpChart
                key={year}
                season={season}
                selected={selected}
                onSelect={setSelected}
              />
            ) : (
              <RankRace
                key={year}
                season={season}
                selected={selected}
                onSelect={setSelected}
              />
            )}
            <p className="mt-2 text-[11px] sm:text-xs text-gray-600">
              Official steak rank after each week. Tap a team to follow it.
            </p>
          </div>

          <div className="lg:col-span-4 space-y-6">
            {facts.length > 0 && (
              <div>
                <SectionLabel>Highlights</SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  {facts.map((fact) => (
                    <button
                      type="button"
                      key={fact.label}
                      onClick={() =>
                        setSelected(
                          fact.teamID === selected
                            ? null
                            : (fact.teamID ?? null),
                        )
                      }
                      className={clsx(
                        'rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                        fact.teamID === selected
                          ? 'border-amber-300/40 bg-amber-300/5'
                          : 'border-gray-800/60 bg-gray-950/30 hover:border-gray-700/80',
                      )}
                    >
                      <div className="text-[10px] uppercase tracking-widest text-gray-500">
                        {fact.label}
                      </div>
                      <div className="mt-1 font-mono text-lg sm:text-xl font-semibold text-gray-100 tabular-nums">
                        {fact.value}
                      </div>
                      <div className="truncate text-[11px] sm:text-xs text-gray-400">
                        {fact.detail}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <SectionLabel>{`After week ${season.weeks[last]}`}</SectionLabel>
              <ol className="rounded-lg border border-gray-800/60 divide-y divide-gray-800/40">
                {latest.map((team) => {
                  const rank = team.ranks[last];
                  const change = last > 0 ? team.ranks[last - 1] - rank : 0;
                  const isSelected = team.id === selected;
                  return (
                    <li key={team.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(isSelected ? null : team.id)}
                        aria-pressed={isSelected}
                        className={clsx(
                          'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs sm:text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400',
                          isSelected
                            ? 'bg-amber-300/10'
                            : 'hover:bg-gray-900/40',
                        )}
                      >
                        <span className="w-5 shrink-0 text-right font-mono text-gray-500 tabular-nums">
                          {rank}
                        </span>
                        <span
                          className={clsx(
                            'flex-1 truncate',
                            isSelected
                              ? 'font-semibold text-amber-200'
                              : zoneText[
                                  getSteakZone(rank, season.teams.length)
                                ],
                          )}
                        >
                          {team.name}
                        </span>
                        <span
                          className={clsx(
                            'w-8 shrink-0 text-right font-mono text-[10px] sm:text-xs tabular-nums',
                            change > 0
                              ? 'text-emerald-400'
                              : change < 0
                                ? 'text-red-400'
                                : 'text-gray-700',
                          )}
                        >
                          {change > 0
                            ? `▲${change}`
                            : change < 0
                              ? `▼${-change}`
                              : '–'}
                        </span>
                        <span className="w-14 shrink-0 text-right font-mono text-gray-400 tabular-nums">
                          {team.totals[last].toFixed(2)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
