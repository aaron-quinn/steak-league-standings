import PlayerName from '../components/PlayerName';
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { FollowPeople } from '../components/FollowSelect';
import RowValue, { signed } from '../components/RowValue';
import SeasonStatus from '../components/SeasonStatus';
import Shell, {
  AllTimeToggle,
  Loading,
  SeasonPicker,
  useAllTime,
  useSeason,
} from '../components/Shell';
import { useAllTimeMoves, type Dated } from '../lib/alltime';
import { buildTrades } from '../lib/moves';
import type { Trade } from '../lib/moves';
import { dateOfDay, seasonLabel, shortDate } from '../lib/season';
import { personName } from '../lib/standings';
import { useMoves } from '../lib/useMoves';

// Close enough to call even
const EVEN = 2;

export default function TradesPage() {
  const [season] = useSeason();
  const [allTime] = useAllTime();
  const { league, days, names, proTeams, rates, ready } = useMoves(season);
  const all = useAllTimeMoves(allTime);
  const [followed, setFollowed] = useState<string | null>(null);

  const trades = useMemo<Dated<Trade>[]>(() => {
    if (allTime) return all.trades;
    if (!ready) return [];
    return buildTrades(league!, days!, names, rates!).map((r) => ({
      ...r,
      season,
    }));
  }, [allTime, all.trades, ready, league, days, names, rates, season]);

  const loading = allTime ? all.isPending : !ready;
  const teamOf = allTime ? all.proTeams : proTeams;
  const openerOf = (t: Dated<Trade>) =>
    allTime ? all.openers[t.season] : league!.opener;
  const owners = useMemo(
    () => trades.flatMap((t) => t.sides.map((s) => s.owner)),
    [trades],
  );

  // Each person's net: points received minus points their trade partners got
  const ledger = useMemo(() => {
    const net = new Map<string, { owner: string; trades: number; net: number }>();
    for (const trade of trades) {
      if (trade.sides.length !== 2) continue;
      const [a, b] = trade.sides;
      for (const [side, other] of [
        [a, b],
        [b, a],
      ]) {
        const row = net.get(side.owner) ?? {
          owner: side.owner,
          trades: 0,
          net: 0,
        };
        row.trades++;
        row.net += side.points - other.points;
        net.set(side.owner, row);
      }
    }
    return [...net.values()].sort((x, y) => y.net - x.net);
  }, [trades]);

  // Biggest win first, most even last; ties go to the more recent deal
  const shown = trades
    .filter(
      (t) => followed === null || t.sides.some((s) => s.owner === followed),
    )
    .sort((a, b) => b.margin - a.margin || b.day - a.day);

  return (
    <Shell
      title="Trades"
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
        <Loading label="Loading trades" />
      ) : trades.length === 0 ? (
        <div className="nba-panel">
          <div className="nba-empty">
            <b>No trades yet</b>Every deal shows up here with who won it.
          </div>
        </div>
      ) : (
        <div className="nba-grid">
          <section className="nba-panel" aria-label="Trades">
            <div className="nba-panel-head">
              <h3 className="nba-panel-title">
                {trades.length} {trades.length === 1 ? 'trade' : 'trades'}
              </h3>
              <FollowPeople
                names={
                  allTime ? owners : (league?.teams.map(personName) ?? [])
                }
                value={followed}
                onChange={setFollowed}
              />
            </div>
            <p className="nba-metric-note">
              Roto points measure a player’s contribution to your category
              standings. Biggest wins are listed first.
            </p>
            <ul className="nba-rows">
              {shown.map((trade) => (
                <li
                  key={`${trade.season}-${trade.day}-${trade.sides
                    .map((s) => s.team)
                    .join('-')}`}
                  className="nba-trade"
                >
                  <div className="nba-trade-head">
                    <span>
                      {allTime && `${seasonLabel(trade.season)} · `}
                      {shortDate(dateOfDay(openerOf(trade), trade.day))}
                    </span>
                  </div>
                  <div
                    className={clsx('nba-trade-result', {
                      won: trade.margin >= EVEN,
                    })}
                  >
                    <div className="nba-trade-verdict">
                      <span className="nba-trade-result-label">
                        {trade.margin < EVEN ? 'No clear winner' : 'Winner'}
                      </span>
                      <strong>
                        {trade.margin < EVEN
                          ? 'About even'
                          : trade.sides[0].owner}
                      </strong>
                    </div>
                    <div className="nba-trade-margin">
                      <span className="nba-trade-result-label">
                        {trade.margin < EVEN ? 'Gap' : 'Won by'}
                      </span>
                      <strong>
                        {trade.margin.toFixed(1)} <small>roto points</small>
                      </strong>
                    </div>
                  </div>
                  <div className="nba-metric-heading">Roto points added</div>
                  <div className="nba-trade-exchange">
                    {trade.sides.map((side, i) => (
                      <div
                        key={side.team}
                        className={clsx('nba-trade-side', {
                          won: i === 0 && trade.margin >= EVEN,
                        })}
                      >
                        <span className="nba-row-main">
                          <span className="nba-row-title">
                            {side.owner} got
                          </span>
                          {side.received.map((r) => (
                            <span key={r.playerID} className="nba-row-sub">
                              <PlayerName
                                name={r.player}
                                proTeam={teamOf[r.playerID]}
                              />{' '}
                              · {r.points.toFixed(1)} in {r.games} games
                            </span>
                          ))}
                        </span>
                        <RowValue value={side.points} />
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <div>
            <section className="nba-panel" aria-label="Trade ledger">
              <div className="nba-panel-head">
                <h3 className="nba-panel-title">Who traded best</h3>
              </div>
              <div className="nba-metric-heading nba-metric-heading-panel">
                Net roto points
              </div>
              <ul className="nba-rows">
                {ledger.map((row) => (
                  <li
                    key={row.owner}
                    className="nba-row"
                    onClick={() =>
                      setFollowed(followed === row.owner ? null : row.owner)
                    }
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="nba-row-main">
                      <span className="nba-row-title">{row.owner}</span>
                      <span className="nba-row-sub">
                        {row.trades} {row.trades === 1 ? 'trade' : 'trades'}
                      </span>
                    </span>
                    <RowValue value={row.net} sign />
                  </li>
                ))}
              </ul>
            </section>
            <p className="nba-foot">
              Each side is credited with the roto points its new players added
              while in its lineup, from the trade to the end of the season (or
              until they moved on). A margin under {EVEN} roto points counts as
              even; {signed(3)} net means three roto points better off than the
              people traded with.{allTime ? ' Pooled over every finished season.' : ''}
            </p>
          </div>
        </div>
      )}
    </Shell>
  );
}
