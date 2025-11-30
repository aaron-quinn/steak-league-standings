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
    parts.push(`${Math.abs(team.pointsBack).toFixed(1)} pts ahead`);
  } else {
    parts.push(`${team.pointsBack.toFixed(1)} pts back`);
  }

  if (team.winsBack === 0) {
    // Tied in record - show points back from record spot holder as tiebreaker
    if (team.recordSpotPointsBack === 0) {
      parts.push('Tied in record (tied in pts)');
    } else if (team.recordSpotPointsBack < 0) {
      parts.push(
        `Tied in record (${Math.abs(team.recordSpotPointsBack).toFixed(1)} pts ahead)`,
      );
    } else {
      parts.push(
        `Tied in record (${team.recordSpotPointsBack.toFixed(1)} pts back)`,
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
    <div className="py-1.5 sm:py-2 antialiased">
      {playoffTeams.map(([qualifier, name], index) => (
        <div
          key={name}
          className="py-1 sm:py-1.5 px-2 sm:px-3 flex items-start gap-1.5 sm:gap-2"
        >
          <span className="text-blue-500/70 font-mono text-[10px] sm:text-xs w-4 sm:w-5 relative top-0.5 sm:top-1 shrink-0">
            #{index + 1}
          </span>
          <div className="min-w-0">
            <div className="text-gray-400 text-xs sm:text-sm truncate">
              {name}
            </div>
            <div className="text-gray-600 text-[10px] sm:text-xs truncate">
              {qualifier}
            </div>
          </div>
        </div>
      ))}

      {bubbleTeams.length > 0 && (
        <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-800/40">
          <div className="px-2 sm:px-3 pb-1.5 sm:pb-2 text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide">
            In the Race
          </div>
          {bubbleTeams.map((team) => (
            <div
              key={team.name}
              className="py-1 sm:py-1.5 px-2 sm:px-3 flex items-start gap-1.5 sm:gap-2"
            >
              <span className="text-orange-500/60 font-mono text-[10px] sm:text-xs w-4 sm:w-5 relative top-0.5 sm:top-1 shrink-0">
                •
              </span>
              <div className="min-w-0">
                <div className="text-gray-500 text-xs sm:text-sm truncate">
                  {team.name}
                </div>
                <div className="text-gray-600 text-[10px] sm:text-xs truncate">
                  {formatGap(team)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
