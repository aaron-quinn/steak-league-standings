import { CATEGORIES, type StatLine } from '../lib/roto';
import { formatPoints } from '../lib/format';
import { TOP_STARS, type StarLine, type Stars } from '../lib/stars';
import type { TonightTeam } from '../lib/tonight';
import FollowSelect from './FollowSelect';
import TonightPlayers from './TonightPlayers';
import PlayerName from './PlayerName';

interface Props {
  stars: Stars;
  // "Tonight" or "Last night"
  when: 'Tonight' | 'Last night';
  // Whether today's games have any lines yet
  canTonight: boolean;
  canLastNight: boolean;
  onLastNight: (lastNight: boolean) => void;
  date: string;
  live: boolean;
  manager: (team: number) => string;
  // Every team, to pick one to filter down to
  teams: { id: number; name: string }[];
  team: number | null;
  onTeam: (team: number | null) => void;
  // The followed team's whole box score (last night only)
  box?: TonightTeam;
}

// "34 PTS · 9 REB · 12/20 FG": the counting stats he got, then his shooting
function statLine(line: StatLine) {
  const parts = [0, 1, 2, 3, 4, 5]
    .filter((i) => i === 0 || line[i] > 0)
    .map((i) => `${line[i]} ${CATEGORIES[i].label}`);
  if (line[7]) parts.push(`${line[6]}/${line[7]} FG`);
  if (line[9]) parts.push(`${line[8]}/${line[9]} FT`);
  return parts.join(' · ');
}

// The day's best player-games across the league (or one team), a leader for
// each category, and the side stories. Bench and IR lines didn't count, so
// they only show in their own list.
export default function DayStars({
  stars,
  when,
  canTonight,
  canLastNight,
  onLastNight,
  date,
  live,
  manager,
  teams,
  team,
  onTeam,
  box,
}: Props) {
  const { players, leaders, benchedOff, brick, bestNight, swings } = stars;
  const best = players[0]?.score || 1;
  const owner = (p: StarLine) => manager(p.team);
  const row = (p: StarLine, rank: number | string) => (
    <li key={p.id}>
      <span className="rank">{rank}</span>
      <span className="who">
        <PlayerName name={p.name} proTeam={p.proTeam} />
        <span className="line">{statLine(p.line)}</span>
      </span>
      <span className="owner">{owner(p)}</span>
      <span className="bar" aria-hidden="true">
        <span style={{ width: `${Math.max(4, (Math.max(0, p.score) / best) * 100)}%` }} />
      </span>
    </li>
  );

  return (
    <section className="nba-panel nba-stars" aria-label={`${when}'s stars`}>
      <div className="nba-panel-head">
        <h3 className="nba-panel-title">{when}&rsquo;s stars</h3>
        <div className="nba-stars-tools">
          <span className="nba-stars-when">
            {live && <span className="nba-live-dot" aria-hidden="true" />}
            {live ? 'Live · ' : ''}
            {date}
          </span>
          <div className="nba-seg" role="group" aria-label="Which night">
            <button
              type="button"
              aria-pressed={when === 'Tonight'}
              disabled={!canTonight}
              title={canTonight ? undefined : 'No lines yet tonight'}
              onClick={() => onLastNight(false)}
            >
              Tonight
            </button>
            <button
              type="button"
              aria-pressed={when === 'Last night'}
              disabled={!canLastNight}
              onClick={() => onLastNight(true)}
            >
              Last night
            </button>
          </div>
          <FollowSelect teams={teams} value={team} onChange={onTeam} />
        </div>
      </div>

      {box && team !== null && (
        <>
          <h4 className="nba-history-sub">{manager(team)}&rsquo;s box score</h4>
          <TonightPlayers team={box} dayLabel="Last night" />
        </>
      )}

      {!players.length && !benchedOff.length ? (
        <div className="nba-empty">
          <b>Nobody yet</b>
          {team !== null && `${manager(team)} has no one with a line ${when.toLowerCase()}.`}
        </div>
      ) : (
        <>
          {players.length > 0 && (
            <ol className="nba-stars-top">
              {players.slice(0, TOP_STARS).map((p, i) => row(p, i + 1))}
            </ol>
          )}

          {leaders.length > 0 && (
            <>
              <h4 className="nba-history-sub">Category leaders</h4>
              <ul className="nba-stars-cats">
                {leaders.map(({ category, value, star, tied }) => {
                  const c = CATEGORIES[category];
                  const shooting = category >= 6;
                  return (
                    <li key={c.key}>
                      <span className="label">{c.label}</span>
                      <b>
                        {shooting
                          ? `${star.line[category === 6 ? 6 : 8]}/${star.line[category === 6 ? 7 : 9]}`
                          : value}
                      </b>
                      <span className="name">
                        {star.name}
                        {tied > 0 && <span className="nba-faint"> +{tied}</span>}
                      </span>
                      <span className="owner">{owner(star)}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {swings.length > 0 && (
            <>
              <h4 className="nba-history-sub">🥩 Steak swing</h4>
              <p className="nba-stars-explain">
                Roto points each line is worth to its manager. Take the line back out of the
                team&rsquo;s season totals, rescore the standings, and this is how many points the
                team would lose. Early in the season one game moves a lot; it settles as totals
                grow.
              </p>
              <ol className="nba-stars-top nba-stars-swing">
                {swings.map(({ star, points }, i) => (
                  <li key={star.id}>
                    <span className="rank">{i + 1}</span>
                    <span className="who">
                      <PlayerName name={star.name} proTeam={star.proTeam} />
                      <span className="line">{statLine(star.line)}</span>
                    </span>
                    <span className="owner">
                      <b title={`${owner(star)} would have ${formatPoints(points)} fewer roto points without this line`}>
                        +{formatPoints(points)}
                      </b>
                      <span>{owner(star)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}

          {(bestNight || brick) && (
            <ul className="nba-stars-stories">
              {bestNight && (
                <li>
                  <span className="label">🏆 Best night</span>
                  <b>{manager(bestNight.team)}</b>
                  <span>Led by {bestNight.best.name}</span>
                </li>
              )}
              {brick && (
                <li>
                  <span className="label">🧱 Brick of the night</span>
                  <b>{brick.name}</b>
                  <span>
                    {statLine(brick.line)} for {owner(brick)}
                  </span>
                </li>
              )}
            </ul>
          )}

          {benchedOff.length > 0 && (
            <>
              <h4 className="nba-history-sub">🪑 Went off on the bench</h4>
              <ul className="nba-stars-top benched">{benchedOff.map((p) => row(p, ''))}</ul>
            </>
          )}
        </>
      )}

      <p className="nba-foot" style={{ margin: 0, padding: '10px 12px 12px' }}>
        Rostered players only; bench and IR lines show only under &ldquo;went off on the
        bench&rdquo;, when they&rsquo;d have made the top {TOP_STARS}. Ranked by how far each line
        beats the day&rsquo;s average in every category, with shooting weighted by attempts.
        Shooting leaders need 8 field goal or 5 free throw tries.
      </p>
    </section>
  );
}
