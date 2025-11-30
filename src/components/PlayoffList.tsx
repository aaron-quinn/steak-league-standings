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
    parts.push(`${formatted} wins ahead`);
  } else {
    const formatted =
      team.winsBack % 1 === 0.5
        ? `${Math.floor(team.winsBack)}½`
        : team.winsBack.toString();
    parts.push(`${formatted} wins back`);
  }

  return parts.join(', ');
}

export default function PlayoffList({
  playoffTeams,
  bubbleTeams,
}: PlayoffListProps) {
  return (
    <div className="py-2 antialiased">
      {playoffTeams.map(([qualifier, name], index) => (
        <div key={name} className="py-1.5 px-3 flex items-start gap-2">
          <span className="text-blue-500/70 font-mono text-xs w-5 relative top-1">
            #{index + 1}
          </span>
          <div>
            <div className="text-gray-400 text-sm">{name}</div>
            <div className="text-gray-600 text-xs">{qualifier}</div>
          </div>
        </div>
      ))}

      {bubbleTeams.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-800/40">
          <div className="px-3 pb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
            In the Race
          </div>
          {bubbleTeams.map((team) => (
            <div key={team.name} className="py-1.5 px-3 flex items-start gap-2">
              <span className="text-orange-500/60 font-mono text-xs w-5 relative top-1">
                •
              </span>
              <div>
                <div className="text-gray-500 text-sm">{team.name}</div>
                <div className="text-gray-600 text-xs">{formatGap(team)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
