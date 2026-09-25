import type { BubbleTeam } from '../types/BubbleTeam';

interface PlayoffListProps {
  playoffTeams: [string, string][];
  bubbleTeams: BubbleTeam[];
}

function formatGap(team: BubbleTeam): string {
  const parts: string[] = [];

  if (team.pointsBack === 0) {
    parts.push('Tied in pts');
  } else if (team.pointsBack < 0) {
    parts.push(`${Math.abs(team.pointsBack).toFixed(2)} pts ahead`);
  } else {
    parts.push(`${team.pointsBack.toFixed(2)} pts back`);
  }

  if (team.winsBack === 0) {
    // Tied in record - show points back from record spot holder as tiebreaker
    if (team.recordSpotPointsBack === 0) {
      parts.push('Tied in record (tied in pts)');
    } else if (team.recordSpotPointsBack < 0) {
      parts.push(
        `Tied in record (${Math.abs(team.recordSpotPointsBack).toFixed(2)} pts ahead)`,
      );
    } else {
      parts.push(
        `Tied in record (${team.recordSpotPointsBack.toFixed(2)} pts back)`,
      );
    }
  } else if (team.winsBack < 0) {
    const winsAhead = Math.abs(team.winsBack);
    const formatted =
      winsAhead % 1 === 0.5
        ? `${Math.floor(winsAhead)}½`
        : winsAhead.toString();
    parts.push(`${formatted} win${winsAhead === 1 ? '' : 's'} ahead`);
  } else {
    const formatted =
      team.winsBack % 1 === 0.5
        ? `${Math.floor(team.winsBack)}½`
        : team.winsBack.toString();
    parts.push(`${formatted} win${team.winsBack === 1 ? '' : 's'} back`);
  }

  return parts.join(', ');
}

export default function PlayoffList({
  playoffTeams,
  bubbleTeams,
}: PlayoffListProps) {
  return (
    <div className="antialiased">
      <ol className="divide-y divide-gray-800/40">
        {playoffTeams.map(([qualifier, name], index) => (
          <li
            key={name}
            className="py-2 px-2.5 sm:px-3 flex items-center gap-2.5 sm:gap-3"
          >
            <span className="size-5 sm:size-6 rounded-full bg-gray-800/50 text-gray-400 font-mono text-[10px] sm:text-xs flex items-center justify-center shrink-0">
              {index + 1}
            </span>
            <div className="min-w-0">
              <div className="text-gray-300 text-xs sm:text-sm font-medium truncate">
                {name}
              </div>
              <div className="text-gray-500 text-[10px] sm:text-xs truncate">
                {qualifier}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {bubbleTeams.length > 0 && (
        <div className="border-t border-gray-800/60 pt-2.5 sm:pt-3">
          <div className="px-2.5 sm:px-3 text-[10px] sm:text-[11px] font-medium text-gray-500 uppercase tracking-widest">
            In the Race
          </div>
          <ul className="divide-y divide-gray-800/40">
            {bubbleTeams.map((team) => (
              <li
                key={team.name}
                className="py-2 px-2.5 sm:px-3 flex items-center gap-2.5 sm:gap-3"
              >
                <span className="size-5 sm:size-6 flex items-center justify-center shrink-0">
                  <span className="size-1.5 rounded-full bg-amber-500/60" />
                </span>
                <div className="min-w-0">
                  <div className="text-gray-400 text-xs sm:text-sm truncate">
                    {team.name}
                  </div>
                  <div className="text-gray-600 text-[10px] sm:text-xs truncate">
                    {formatGap(team)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
