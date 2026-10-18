import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Shell, { Loading } from '../components/Shell';
import { useAllLeagues } from '../lib/data';
import { buildPeople } from '../lib/people';

export default function ManagersPage() {
  const { leagues, isPending } = useAllLeagues();
  const people = useMemo(() => (isPending ? [] : buildPeople(leagues)), [leagues, isPending]);

  return (
    <Shell title="Managers" status={<span>Everyone who&rsquo;s played since 2018–19</span>} tools={<></>}>
      {isPending ? (
        <Loading label="Loading managers" />
      ) : (
        <section className="nba-panel" aria-label="Managers">
          <ul className="nba-rows">
            {people.map((person) => {
              const played = person.ate + person.bought;
              return (
                <li key={person.slug}>
                  <Link to={`/nba/managers/${person.slug}`} className="nba-row nba-row-link">
                    <span className="nba-row-main">
                      <span className="nba-row-title">
                        {person.name}
                        {person.titles > 0 && (
                          <span className="nba-titles" aria-label={`${person.titles} titles`}>
                            {' '}
                            {'🏆'.repeat(person.titles)}
                          </span>
                        )}
                      </span>
                      <span className="nba-row-sub">
                        {person.seasons.length} {person.seasons.length === 1 ? 'season' : 'seasons'}
                        {played > 0 && ` · ate ${person.ate} of ${played}`}
                      </span>
                    </span>
                    <span className="nba-row-value">
                      {played ? `${Math.round((100 * person.ate) / played)}%` : '–'}
                      <small>steaks</small>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Shell>
  );
}
