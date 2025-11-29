import { useRef, useMemo } from 'react';
import clsx from 'clsx';
import domToImage from 'dom-to-image';
import { saveAs } from 'file-saver';
import { useStandingsStore } from '../stores/standings';
import getManagers from '../data/managers';
import type { TeamWithGap } from '../types/TeamWithGap';

export default function StandingsList() {
  const rootRef = useRef<HTMLUListElement>(null);
  const standings = useStandingsStore((state) => state.standings);
  const year = useStandingsStore((state) => state.year);
  const live = useStandingsStore((state) => state.live);

  const { teamsWithGap, steakLineTeam, selfBuyerSpot } = useMemo(() => {
    const managers = getManagers();

    const steakTeams = managers
      .filter((t) => t.teams[year] && 'steak' in t.teams[year])
      .map((t) => {
        const teamYear = t.teams[year];
        const league = teamYear.league || '';
        const teamID = teamYear.teamID || '';
        const division = teamYear.division || '';
        const id = `${league.toLowerCase()}${teamID}`;
        const teamStanding = standings[id] || {
          points: 0,
          wins: 0,
          losses: 0,
          ties: 0,
        };
        return {
          id,
          name: t.name,
          league,
          division,
          teamID,
          points: teamStanding.points,
          wins: teamStanding.wins,
          losses: teamStanding.losses,
          ties: teamStanding.ties,
          record: `${teamStanding.wins}-${teamStanding.losses}-${teamStanding.ties}`,
          teams: t.teams,
        };
      })
      .sort((a, b) => {
        if (a.points === b.points) {
          return a.name.localeCompare(b.name);
        }
        return b.points - a.points;
      });

    const teams = [...steakTeams];

    // Calculate the number of teams that get a steak
    const numTeamsGettingASteak = Math.floor(teams.length / 2);

    // Is there a self-buyer spot
    const selfBuyer = teams.length % 2 !== 0;

    const steakLine = selfBuyer
      ? numTeamsGettingASteak
      : numTeamsGettingASteak - 1;

    // Calculate the points scored by the team at the steak line
    const steakLinePts = teams[steakLine]?.points || 0;

    // Add the distance from the steak line
    const withGap: TeamWithGap[] = teams.map((t) => {
      const gap = Math.round((t.points - steakLinePts) * 10) / 10;
      const gapOperator = gap > 0 ? '+' : '';
      const pointsPieces = t.points.toString().split('.');
      const gapPieces = gap.toFixed(2).toString().split('.');
      return {
        ...t,
        gap: Number(gap) === 0 ? 0 : gap.toFixed(2),
        gapOperator,
        pointsInt: pointsPieces[0],
        pointsDec: pointsPieces[1],
        gapInt: gapPieces[0],
        gapDec: gapPieces[1],
      };
    });

    return {
      teamsWithGap: withGap,
      steakLineTeam: steakLine,
      selfBuyerSpot: selfBuyer,
    };
  }, [standings, year]);

  function triggerScreenshot() {
    if (!rootRef.current) return;

    const classesForImage = ['bg-slate-900', 'p-4'];
    classesForImage.forEach((className) => {
      rootRef.current?.classList.add(className);
    });

    domToImage
      .toBlob(rootRef.current)
      .then(function (blob) {
        if (blob) {
          saveAs(blob, 'steak-league-standings.png');
        }
        classesForImage.forEach((className) => {
          rootRef.current?.classList.remove(className);
        });
      })
      .catch((err) => {
        console.error(err);
      });
  }

  return (
    <>
      <ul className="w-full antialiased" ref={rootRef}>
        {teamsWithGap.map((team, index) => (
          <li
            key={team.id}
            className={clsx(
              'px-4 py-1 lg:py-2 w-full bg-slate-800 text-slate-300 font-light text-base lg:text-xl flex justify-between shadow-2xl items-center',
              {
                'rounded-t-md': index === 0 || index === steakLineTeam + 1,
                'rounded-b-md': index === teamsWithGap.length - 1,
                'mb-0': index !== steakLineTeam,
                'mt-4 mb-4 lg:mt-6 lg:mb-6 rounded-md':
                  index === steakLineTeam && selfBuyerSpot,
                'mb-4 lg:mb-6 rounded-b-md':
                  index === steakLineTeam && !selfBuyerSpot,
              },
            )}
          >
            <div className="flex items-center">
              <div className="w-5">{index + 1}</div>
              <div
                className={clsx('ml-2', {
                  'cursor-pointer': team.name.includes('Kurt'),
                })}
              >
                {team.name}
                {!live && (
                  <span className="text-slate-400 ml-2 text-xs lg:text-sm">
                    {team.record}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center font-numerals tracking-tight">
              <div className="text-base lg:text-lg">
                <span>
                  {Number(team.pointsInt).toLocaleString('en-US')}
                  <span className="text-slate-400 text-[11px] lg:text-xs relative left-[1px]">
                    .{team.pointsDec}
                  </span>
                </span>
              </div>
              <div
                className={clsx(
                  'w-12 lg:w-14 text-right ml-3 text-sm lg:text-base font-bold',
                  {
                    'text-green-500': Number(team.gap) > 0,
                    'text-gray-500': Number(team.gap) === 0,
                    'text-red-500': Number(team.gap) < 0,
                  },
                )}
              >
                {team.gap === 0 ? (
                  <span>&ndash;</span>
                ) : (
                  <>
                    <span>{team.gapOperator + team.gapInt}</span>
                    <span className="text-[11px] lg:text-xs left-[1px] relative font-normal">
                      .{team.gapDec}
                    </span>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex justify-end mt-3 mb-5">
        <button
          className="bg-slate-300 hover:bg-slate-400 text-slate-800 px-4 py-1 rounded-md text-sm font-semibold inline-flex items-center"
          onClick={triggerScreenshot}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            className="w-5 h-5 mr-2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
            />
          </svg>
          Screenshot
        </button>
      </div>
    </>
  );
}
