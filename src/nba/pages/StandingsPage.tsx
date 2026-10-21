import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CategoryTable from '../components/CategoryTable';
import HistoryPanel from '../components/HistoryPanel';
import SeasonStatus from '../components/SeasonStatus';
import StandingsTable from '../components/StandingsTable';
import WeekView from '../components/WeekView';
import Shell, {
  AllTimeToggle,
  Loading,
  SeasonPicker,
  useAllTime,
  useSeason,
} from '../components/Shell';
import { careerTable, type CareerRow } from '../lib/alltime';
import { useAllLeagues, useLeague, useSeasonDays, useToday, useTonight } from '../lib/data';
import { rankMoves, tonightByTeam } from '../lib/tonight';
import { formatPoints, ordinal } from '../lib/format';
import { FIRST_SEASON, dateOfDay, isFinished, shortDate } from '../lib/season';
import { useSteakOdds } from '../lib/useSteakOdds';
import { buildStandings, hasStarted, playingTime } from '../lib/standings';

type View = 'points' | 'categories' | 'week';

export default function StandingsPage() {
  const [season] = useSeason();
  const [allTime] = useAllTime();
  const { data: league, isError } = useLeague(season);
  const { leagues, isPending: leaguesPending } = useAllLeagues(allTime);
  const [view, setView] = useState<View>('points');
  const rows = useMemo(
    () => (league ? buildStandings(league.teams) : []),
    [league],
  );
  const career = useMemo(
    () => (allTime ? careerTable(leagues) : []),
    [allTime, leagues],
  );
  // Tombstones only mean something while a season is still going
  const live = Boolean(league && !isFinished(season) && hasStarted(league));
  const { pitNow } = useSteakOdds(season, { withHistory: false, enabled: live });
  // Games and minutes played need every day's player lines, so only fetch
  // them for the categories view. 2017-18 (Yahoo) has none.
  const withGames = view === 'categories' && !allTime && season > FIRST_SEASON;
  const { days } = useSeasonDays(season, withGames);
  const played = useMemo(
    () => (withGames && days && league ? playingTime(days, league.lastDay) : undefined),
    [withGames, days, league],
  );
  const today = useToday(season);
  const { data: games } = useTonight(season);
  const moves = useMemo(
    () => (live && league ? rankMoves(league.teams, today.day) : undefined),
    [live, league, today.day],
  );
  const tonight = useMemo(
    () =>
      live && games
        ? tonightByTeam(today.day, games.games, today.names, today.proTeams)
        : undefined,
    [live, games, today.day, today.names, today.proTeams],
  );

  return (
    <Shell
      title="Standings"
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
      <div className="nba-grid">
        <div>
          {!allTime && league?.cutoff && (
            <p className="nba-note">
              <span aria-hidden="true">⏱</span>
              <span>
                <b>
                  Ended early: games through{' '}
                  {shortDate(dateOfDay(league.opener, league.lastDay))}
                </b>{' '}
                counted, because of NBA tanking. ESPN&rsquo;s final standings
                kept going, so they differ.
              </span>
            </p>
          )}
          {allTime ? (
            <section className="nba-panel" aria-label="All-time standings">
              <div className="nba-panel-head">
                <h3 className="nba-panel-title">
                  {career.length} managers
                </h3>
              </div>
              {leaguesPending ? (
                <Loading label="Loading history" />
              ) : (
                <CareerTable rows={career} />
              )}
            </section>
          ) : (
            <section className="nba-panel" aria-label="Standings">
              <div className="nba-panel-head">
                <h3 className="nba-panel-title">
                  {league ? `${league.teams.length} teams` : 'Teams'}
                </h3>
                <div className="nba-seg" role="group" aria-label="Standings view">
                  <button
                    aria-pressed={view === 'points'}
                    onClick={() => setView('points')}
                  >
                    Roto points
                  </button>
                  <button
                    aria-pressed={view === 'categories'}
                    onClick={() => setView('categories')}
                  >
                    Categories
                  </button>
                  {!isFinished(season) && (
                    <button
                      aria-pressed={view === 'week'}
                      onClick={() => setView('week')}
                      title="Each team's games this lineup week"
                    >
                      Week
                    </button>
                  )}
                </div>
              </div>
              {isError ? (
                <div className="nba-empty">
                  <b>No standings</b>ESPN didn&rsquo;t answer. Try again in a
                  minute.
                </div>
              ) : !league ? (
                <Loading label="Loading standings" />
              ) : !hasStarted(league) ? (
                <div className="nba-empty">
                  <b>No games yet</b>
                  The season tips off{' '}
                  {shortDate(dateOfDay(league.opener, 1))}.{' '}
                  {league.teams.length} teams are in.
                </div>
              ) : view === 'points' || (view === 'week' && isFinished(season)) ? (
                <StandingsTable
                  rows={rows}
                  showESPN={Boolean(league.cutoff)}
                  buried={pitNow?.buried}
                  moves={moves?.size ? moves : undefined}
                  tonight={tonight}
                  liveSeason={live}
                />
              ) : view === 'week' ? (
                <WeekView key={season} league={league} rows={rows} />
              ) : (
                <CategoryTable rows={rows} games={withGames ? (played ?? null) : undefined} />
              )}
            </section>
          )}
        </div>
        <HistoryPanel />
      </div>
    </Shell>
  );
}

// Every manager, their finished seasons rolled up. Career roto points rise
// with seasons played, so the average finish sits beside them.
function CareerTable({ rows }: { rows: CareerRow[] }) {
  return (
    <>
      <table className="nba-table">
        <caption className="sr-only">
          Career standings: total roto points, titles and average finish over
          every finished season.
        </caption>
        <thead>
          <tr>
            <th className="rank" scope="col">
              #
            </th>
            <th scope="col" style={{ textAlign: 'left' }}>
              Manager
            </th>
            <th className="num" scope="col">
              Titles
            </th>
            <th className="num" scope="col">
              Avg finish
            </th>
            <th className="num" scope="col" style={{ paddingRight: 12 }}>
              Roto points
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.slug} className={i === 0 ? 'leader' : undefined}>
              <td className="rank">{i + 1}</td>
              <td className="team-cell">
                <Link to={`/nba/managers/${row.slug}`} className="who">
                  {row.name}
                </Link>
                <span className="team-name">
                  {row.seasons} {row.seasons === 1 ? 'season' : 'seasons'} · ate{' '}
                  {row.ate} of {row.ate + row.bought}
                  {row.best !== null && ` · best ${ordinal(row.best)}`}
                </span>
              </td>
              <td className="num nba-dim">
                {row.titles ? '🏆'.repeat(row.titles) : '–'}
              </td>
              <td className="num nba-dim">
                Top {Math.max(1, Math.round(100 * (1 - row.averageFinish)))}%
              </td>
              <td className="num pts">{formatPoints(row.points)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="nba-foot" style={{ margin: '0 12px 12px', paddingTop: 12 }}>
        Career roto points are summed over each manager&rsquo;s finished
        seasons, so more seasons means more points; the average finish is the
        fairer read across different tenures.
      </p>
    </>
  );
}
