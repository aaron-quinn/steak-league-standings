import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { BUILD_LABEL, buildProfile } from '../lib/profile';
import { CATEGORIES } from '../lib/roto';
import type { StandingRow } from '../lib/standings';
import BuildShape, { describeSeason } from './BuildShape';

const list = (indexes: number[]) => indexes.map((i) => CATEGORIES[i].label).join(', ');

interface Props {
  row: StandingRow;
  teamCount: number;
  title: string;
  // Where the title links, if anywhere
  to?: string;
  sub: string;
}

// One team-season: its octagon, build, punts and best categories
export default function BuildCard({ row, teamCount, title, to, sub }: Props) {
  const profile = buildProfile(
    row.categories.map((c) => c.points),
    teamCount,
  );
  return (
    <li className="nba-build">
      <div className="nba-build-head">
        {to ? (
          <Link to={to} className="who">
            {title}
          </Link>
        ) : (
          <span className="who">{title}</span>
        )}
        <span className="nba-faint">{sub}</span>
      </div>
      <BuildShape
        shape={profile.shape}
        zone={row.zone}
        label={`${title}, ${sub}`}
        describe={describeSeason(row.categories, teamCount)}
      />
      <div className="nba-build-tags">
        <span className={clsx('nba-build-tag', profile.build)}>{BUILD_LABEL[profile.build]}</span>
        {profile.punts.length > 0 && (
          <span className="nba-build-tag punt">Punting {list(profile.punts)}</span>
        )}
      </div>
      {profile.strengths.length > 0 && (
        <p className="nba-build-best">Top 3 in {list(profile.strengths)}</p>
      )}
    </li>
  );
}
