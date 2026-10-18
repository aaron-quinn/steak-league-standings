import PlayerName from '../components/PlayerName';
import { useMemo, useState } from 'react';
import { FollowPeople } from '../components/FollowSelect';
import RowValue from '../components/RowValue';
import SeasonStatus from '../components/SeasonStatus';
import Shell, {
  AllTimeToggle,
  Loading,
  SeasonPicker,
  useAllTime,
  useSeason,
} from '../components/Shell';
import { useAllTimeMoves, type Dated } from '../lib/alltime';
import { buildPickups } from '../lib/moves';
import type { Pickup } from '../lib/moves';
import { dateOfDay, seasonLabel, shortDate } from '../lib/season';
import { personName } from '../lib/standings';
import { useMoves } from '../lib/useMoves';

type Sort = 'best' | 'priciest' | 'recent';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'best', label: 'Best' },
  { value: 'priciest', label: 'Biggest bids' },
  { value: 'recent', label: 'Latest' },
];

export default function WaiversPage() {
  const [season] = useSeason();
  const [allTime] = useAllTime();
  const { league, days, names, proTeams, rates, ready } = useMoves(season);
  const all = useAllTimeMoves(allTime);
  const [sort, setSort] = useState<Sort>('best');
  const [followed, setFollowed] = useState<string | null>(null);

  const pickups = useMemo<Dated<Pickup>[]>(() => {
    if (allTime) return all.pickups;
    if (!ready) return [];
    return buildPickups(league!, days!, names, rates!).map((r) => ({
      ...r,
      season,
    }));
  }, [allTime, all.pickups, ready, league, days, names, rates, season]);

  const loading = allTime ? all.isPending : !ready;
  const teamOf = allTime ? all.proTeams : proTeams;
  const openerOf = (p: Dated<Pickup>) =>
    allTime ? all.openers[p.season] : league!.opener;
  const owners = useMemo(() => pickups.map((p) => p.owner), [pickups]);

  const teams = useMemo(() => {
    const byTeam = new Map<
      string,
      { owner: string; adds: number; spent: number; points: number }
    >();
    for (const p of pickups) {
      const t =
        byTeam.get(p.owner) ??
        { owner: p.owner, adds: 0, spent: 0, points: 0 };
      t.adds++;
      t.spent += p.bid;
      t.points += p.points;
      byTeam.set(p.owner, t);
    }
    return [...byTeam.values()].sort((a, b) => b.points - a.points);
  }, [pickups]);

  const shown = pickups
    .filter((p) => followed === null || p.owner === followed)
    .sort((a, b) =>
      sort === 'best'
        ? b.points - a.points
        : sort === 'priciest'
          ? b.bid - a.bid || b.points - a.points
          : b.at - a.at,
    )
    .slice(0, 40);

  return (
    <Shell
      title="Waivers"
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
        <Loading label="Loading pickups" />
      ) : pickups.length === 0 ? (
        <div className="nba-panel">
          <div className="nba-empty">
            <b>No pickups yet</b>Waivers run Sunday nights.
          </div>
        </div>
      ) : (
        <div className="nba-grid">
          <section className="nba-panel" aria-label="Pickups">
            <div className="nba-panel-head" style={{ flexWrap: 'wrap' }}>
              <div className="nba-seg" role="group" aria-label="Sort pickups">
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
              <FollowPeople
                names={
                  allTime ? owners : (league?.teams.map(personName) ?? [])
                }
                value={followed}
                onChange={setFollowed}
              />
            </div>
            <div className="nba-metric-heading nba-metric-heading-panel">
              Roto points added
            </div>
            <ul className="nba-rows">
              {shown.map((p) => (
                <li
                  key={`${p.season}-${p.at}-${p.playerID}-${p.team}`}
                  className="nba-row"
                >
                  <span className="nba-row-main">
                    <span className="nba-row-title">
                      <PlayerName
                        name={p.player}
                        proTeam={teamOf[p.playerID]}
                      />
                    </span>
                    <span className="nba-row-sub">
                      {allTime && `${seasonLabel(p.season)} · `}
                      {p.owner} ·{' '}
                      {p.type === 'WAIVER' ? `$${p.bid} bid` : 'free agent'} ·{' '}
                      {shortDate(dateOfDay(openerOf(p), p.day))}, kept {p.held}{' '}
                      {p.held === 1 ? 'day' : 'days'}
                    </span>
                  </span>
                  <RowValue value={p.points} />
                </li>
              ))}
            </ul>
          </section>
          <div>
            <section className="nba-panel" aria-label="Pickups by team">
              <div className="nba-panel-head">
                <h3 className="nba-panel-title">By team</h3>
              </div>
              <div className="nba-metric-heading nba-metric-heading-panel">
                Roto points added
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
                        {t.adds} {t.adds === 1 ? 'pickup' : 'pickups'}, $
                        {t.spent} spent
                      </span>
                    </span>
                    <RowValue value={t.points} />
                  </li>
                ))}
              </ul>
            </section>
            <p className="nba-foot">
              Roto points measure a pickup’s contribution to his new team’s
              category standings while in its lineup, until he was dropped or
              traded.{allTime ? ' Pooled over every finished season.' : ''}
            </p>
          </div>
        </div>
      )}
    </Shell>
  );
}
