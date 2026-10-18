import PlayerName from '../components/PlayerName';
import { useMemo, useState } from 'react';
import { FollowPeople } from '../components/FollowSelect';
import RowValue, { signed } from '../components/RowValue';
import SeasonStatus from '../components/SeasonStatus';
import StandingsOnly from '../components/StandingsOnly';
import Shell, {
  AllTimeToggle,
  Loading,
  SeasonPicker,
  useAllTime,
  useSeason,
} from '../components/Shell';
import { DraftStylesPanel, LoyaltyPanel, PriceTiersPanel } from '../components/DraftStyles';
import { useAllTimeMoves, type Dated } from '../lib/alltime';
import { useAllLeagues } from '../lib/data';
import { draftStyles, priceBands } from '../lib/draftStyle';
import { buildDraft } from '../lib/moves';
import type { DraftRow } from '../lib/moves';
import { isFinished, seasonLabel } from '../lib/season';
import { personName } from '../lib/standings';
import { useMoves } from '../lib/useMoves';

type Sort = 'steals' | 'busts' | 'price';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'steals', label: 'Steals' },
  { value: 'busts', label: 'Busts' },
  { value: 'price', label: 'Price' },
];

export default function DraftPage() {
  const [season] = useSeason();
  const [allTime] = useAllTime();
  const { league, days, names, proTeams, rates, ready } = useMoves(season);
  const all = useAllTimeMoves(allTime);
  const [sort, setSort] = useState<Sort>('steals');
  const [followed, setFollowed] = useState<string | null>(null);

  const picks = useMemo<Dated<DraftRow>[]>(() => {
    if (allTime) return all.draft;
    if (!ready) return [];
    return buildDraft(league!, days!, names, rates!).map((r) => ({
      ...r,
      season,
    }));
  }, [allTime, all.draft, ready, league, days, names, rates, season]);

  const loading = allTime ? all.isPending : !ready;
  const teamOf = allTime ? all.proTeams : proTeams;
  const played = picks.some((p) => p.games > 0);
  const owners = useMemo(() => picks.map((p) => p.owner), [picks]);

  // Each manager's whole auction: points beyond what its prices usually buy
  const teams = useMemo(() => {
    const byTeam = new Map<
      string,
      { owner: string; spent: number; points: number; surplus: number }
    >();
    for (const p of picks) {
      const t =
        byTeam.get(p.owner) ??
        { owner: p.owner, spent: 0, points: 0, surplus: 0 };
      t.spent += p.price;
      t.points += p.points;
      t.surplus += p.surplus;
      byTeam.set(p.owner, t);
    }
    return [...byTeam.values()].sort((a, b) => b.surplus - a.surplus);
  }, [picks]);

  // Habits and re-buys come from every season with an auction, whatever the view
  const { leagues: everyLeague } = useAllLeagues();
  const styles = useMemo(() => draftStyles(everyLeague), [everyLeague]);
  // This season's managers; all-time shows everyone
  const inView = allTime
    ? [...styles.values()]
    : (league?.teams.flatMap((t) => (t.owner ? [styles.get(personName(t))].filter((s) => s !== undefined) : [])) ?? []);

  const bands = useMemo(() => priceBands(picks), [picks]);
  // Seasons each tier beat its price on average (all-time only)
  const beat = useMemo(() => {
    if (!allTime) return undefined;
    const out = new Map<string, { won: number; of: number }>();
    for (const s of new Set(picks.map((p) => p.season))) {
      for (const b of priceBands(picks.filter((p) => p.season === s))) {
        const w = out.get(b.label) ?? { won: 0, of: 0 };
        w.of++;
        if (b.surplus > 0) w.won++;
        out.set(b.label, w);
      }
    }
    return out;
  }, [allTime, picks]);

  const shown = picks
    .filter((p) => followed === null || p.owner === followed)
    .sort((a, b) =>
      sort === 'price' || !played
        ? b.price - a.price || b.season - a.season || a.pick - b.pick
        : sort === 'steals'
          ? b.surplus - a.surplus || b.season - a.season
          : a.surplus - b.surplus || b.season - a.season,
    )
    .slice(0, followed === null ? 40 : undefined);

  return (
    <Shell
      title="Draft"
      status={
        allTime ? (
          <span>Every finished season</span>
        ) : (
          league && <SeasonStatus league={league} />
        )
      }
      tools={
        <div className="nba-tools">
          {!allTime && <SeasonPicker />}
          <AllTimeToggle />
        </div>
      }
    >
      {loading ? (
        <Loading label="Loading the auction" />
      ) : !allTime && isFinished(season) && (days?.length ?? 0) === 0 ? (
        <StandingsOnly season={season} what="auction" />
      ) : picks.length === 0 ? (
        <div className="nba-grid">
          <div className="nba-panel">
            <div className="nba-empty">
              <b>No auction yet</b>Prices show up here once the draft is done.
              {inView.some((s) => s.habits.length) && ' Until then, here’s how this year’s managers usually draft.'}
            </div>
          </div>
          <div className="nba-side-stack">
            <DraftStylesPanel styles={inView} title="How they draft" />
            <LoyaltyPanel styles={inView} limit={8} />
          </div>
        </div>
      ) : (
        <div className="nba-grid">
          <section className="nba-panel" aria-label="Auction picks">
            <div className="nba-panel-head" style={{ flexWrap: 'wrap' }}>
              {played ? (
                <div className="nba-seg" role="group" aria-label="Sort picks">
                  {SORTS.map((s) => (
                    <button
                      key={s.value}
                      aria-pressed={sort === s.value}
                      onClick={() => setSort(s.value)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              ) : (
                <h3 className="nba-panel-title">By price</h3>
              )}
              <FollowPeople
                names={
                  allTime
                    ? owners
                    : (league?.teams.map(personName) ?? [])
                }
                value={followed}
                onChange={setFollowed}
              />
            </div>
            <ul className="nba-rows">
              {shown.map((p) => (
                <li key={`${p.season}-${p.pick}`} className="nba-row">
                  <span className="nba-row-main">
                    <span className="nba-row-title">
                      <PlayerName
                        name={p.player}
                        proTeam={teamOf[p.playerID]}
                      />
                    </span>
                    <span className="nba-row-sub">
                      {allTime && `${seasonLabel(p.season)} · `}${p.price} ·{' '}
                      {p.owner}
                      {played &&
                        ` · ${p.games} games, ${p.points.toFixed(1)} roto points`}
                    </span>
                  </span>
                  {played ? (
                    <RowValue value={p.surplus} label="vs price" sign />
                  ) : (
                    <span className="nba-row-value">${p.price}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <div className="nba-side-stack">
          {played && (
            <div>
              <section className="nba-panel" aria-label="Best auctions">
                <div className="nba-panel-head">
                  <h3 className="nba-panel-title">Best auctions</h3>
                </div>
                <ul className="nba-rows">
                  {teams.map((t) => (
                    <li
                      key={t.owner}
                      className="nba-row"
                      onClick={() =>
                        setFollowed(followed === t.owner ? null : t.owner)
                      }
                      style={{ cursor: 'pointer' }}
                    >
                      <span className="nba-row-main">
                        <span className="nba-row-title">{t.owner}</span>
                        <span className="nba-row-sub">
                          {t.points.toFixed(1)} roto points from ${t.spent}
                        </span>
                      </span>
                      <RowValue value={t.surplus} label="vs prices" sign />
                    </li>
                  ))}
                </ul>
              </section>
              <p className="nba-foot">
                Roto points measure each pick’s contribution to his team’s
                category standings while in its lineup.
                {allTime
                  ? ' Pooled over every finished season.'
                  : ''}{' '}
                &ldquo;Vs price&rdquo; compares that with what picks at the same
                price produced on average: {signed(5)} means five roto points
                more than his price promised.
              </p>
            </div>
          )}
          {played && <PriceTiersPanel bands={bands} beat={beat} />}
          <DraftStylesPanel styles={inView} />
          {allTime && <LoyaltyPanel styles={inView} />}
          </div>
        </div>
      )}
    </Shell>
  );
}
