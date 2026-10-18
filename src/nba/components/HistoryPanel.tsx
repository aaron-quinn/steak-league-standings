import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAllLeagues } from '../lib/data';
import { slugify } from '../lib/people';
import { CURRENT_SEASON, isFinished, seasonLabel } from '../lib/season';
import { lastName, personName, seasonResult } from '../lib/standings';

type Tab = 'steaks' | 'champions';

// Steak leaders and champions over every finished season, like the NFL page
export default function HistoryPanel() {
  const [tab, setTab] = useState<Tab>('steaks');
  const { leagues, isPending } = useAllLeagues();

  const results = useMemo(
    () =>
      isPending
        ? []
        : leagues.filter((l) => isFinished(l.season)).map(seasonResult),
    [leagues, isPending],
  );

  const leaders = useMemo(() => {
    const people = new Map<string, boolean[]>();
    for (const result of results) {
      for (const [name, ate] of result.steaks) {
        if (!people.has(name)) people.set(name, []);
        people.get(name)!.push(ate);
      }
    }
    // This season's managers first, then everyone who has left the league
    const current = leagues.find((l) => l.season === CURRENT_SEASON);
    const active = new Set(current?.teams.map(personName));
    const all = [...people.entries()]
      .map(([name, steaks]) => ({
        name,
        ate: steaks.filter(Boolean).length,
        bought: steaks.filter((s) => !s).length,
      }))
      .sort((a, b) => b.ate - a.ate || a.bought - b.bought || a.name.localeCompare(b.name));
    return {
      active: all.filter((p) => active.has(p.name)),
      past: all.filter((p) => !active.has(p.name)),
    };
  }, [results, leagues]);

  return (
    <section className="nba-panel" aria-label="League history">
      <div className="nba-panel-head">
        <h3 className="nba-panel-title">History</h3>
        <div className="nba-seg" role="tablist" aria-label="History">
          <button role="tab" aria-selected={tab === 'steaks'} onClick={() => setTab('steaks')}>
            Steak Leaders
          </button>
          <button role="tab" aria-selected={tab === 'champions'} onClick={() => setTab('champions')}>
            Champions
          </button>
        </div>
      </div>
      {isPending ? (
        <div className="nba-empty">Loading…</div>
      ) : tab === 'steaks' ? (
        <>
          <LeaderList people={leaders.active} />
          {leaders.past.length > 0 && (
            <>
              <h4 className="nba-history-sub">Past managers</h4>
              <LeaderList people={leaders.past} />
            </>
          )}
        </>
      ) : (
        <ul className="nba-history-list">
          {[...results].reverse().map((result) => (
            <li key={result.season}>
              <span>
                <span className="nba-champ-year">{seasonLabel(result.season)}</span>
                <Link to={`/nba/managers/${slugify(result.champion)}`} className="nba-champ-name">
                  {result.champion}
                </Link>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LeaderList({ people }: { people: { name: string; ate: number; bought: number }[] }) {
  return (
    <ul className="nba-history-list">
      {people.map((person) => (
        <li key={person.name}>
          <Link to={`/nba/managers/${slugify(person.name)}`} className="nba-steak-name" title={person.name}>
            {lastName(person.name)}
            <span className="nba-steak-pct">
              {Math.round((100 * person.ate) / (person.ate + person.bought))}%
            </span>
          </Link>
          <span className="nba-steaks" aria-label={`Ate ${person.ate}, bought ${person.bought}`}>
            {Array.from({ length: person.ate }, (_, i) => (
              <span key={`a${i}`}>🥩</span>
            ))}
            {Array.from({ length: person.bought }, (_, i) => (
              <span key={`b${i}`} className="bought">
                🪦
              </span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
