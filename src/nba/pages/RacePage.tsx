import { useMemo, useState } from 'react';
import FollowSelect from '../components/FollowSelect';
import RaceChart from '../components/RaceChart';
import SeasonStatus from '../components/SeasonStatus';
import Shell, { Loading, useSeason } from '../components/Shell';
import StandingsOnly from '../components/StandingsOnly';
import { useLeague, useSeasonTotals } from '../lib/data';
import { buildRace, raceFacts } from '../lib/race';
import { isFinished } from '../lib/season';

export default function RacePage() {
  const [season] = useSeason();
  const { data: league } = useLeague(season);
  const { totals } = useSeasonTotals(season);
  const [followed, setFollowed] = useState<number | null>(null);

  const race = useMemo(
    () => (league && totals ? buildRace(league, totals) : null),
    [league, totals],
  );
  const facts = useMemo(() => (race ? raceFacts(race) : []), [race]);

  return (
    <Shell title="Steak Race" status={league && <SeasonStatus league={league} />}>
      {!race ? (
        <Loading label="Loading the race" />
      ) : race.checkpoints.length === 0 ? (
        isFinished(season) ? (
          <StandingsOnly season={season} what="week-by-week record" />
        ) : (
          <div className="nba-panel">
            <div className="nba-empty">
              <b>No race yet</b>The first week ends the Sunday after opening
              night.
            </div>
          </div>
        )
      ) : (
        <>
          <section className="nba-panel" aria-label="Steak positions by week">
            <div className="nba-panel-head">
              <h3 className="nba-panel-title">Week by week</h3>
              <FollowSelect teams={race.teams} value={followed} onChange={setFollowed} />
            </div>
            <div className="nba-panel-body">
              <RaceChart race={race} followed={followed} onFollow={setFollowed} />
              <p className="nba-foot" style={{ margin: '8px 0 0' }}>
                Shaded rows eat steak. Lines show where each team stood when
                lineups locked each Monday; tap one to follow it.
              </p>
            </div>
          </section>
          {facts.length > 0 && (
            <dl className="nba-facts" style={{ marginTop: 16 }}>
              {facts.map((fact) => (
                <div
                  key={fact.label}
                  className="nba-fact"
                  onClick={() => fact.teamID !== undefined && setFollowed(fact.teamID)}
                  style={{ cursor: fact.teamID !== undefined ? 'pointer' : undefined }}
                >
                  <dt>{fact.label}</dt>
                  <dd>
                    <span className="big">{fact.value}</span>
                    <span className="small">{fact.detail}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </>
      )}
    </Shell>
  );
}
