interface PlayoffListProps {
  playoffTeams: [string, string][];
}

export default function PlayoffList({ playoffTeams }: PlayoffListProps) {
  return (
    <div className="py-2 antialiased">
      {playoffTeams.map(([qualifier, name], index) => (
        <div key={name} className="py-1.5 px-3 flex items-start gap-2">
          <span className="text-blue-500/70 font-mono text-xs w-4">
            {index + 1}
          </span>
          <div>
            <div className="text-gray-400 text-sm">{name}</div>
            <div className="text-gray-600 text-xs">{qualifier}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
