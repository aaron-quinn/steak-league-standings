interface PlayoffListProps {
  playoffTeams: [string, string][];
}

export default function PlayoffList({ playoffTeams }: PlayoffListProps) {
  return (
    <div className="py-3 antialiased">
      {playoffTeams.map(([qualifier, name], index) => (
        <div key={name} className="py-2 px-4 flex items-start gap-3 hover:bg-navy-900/30 transition-colors">
          <span className="text-accent-500 font-mono text-sm font-medium w-5">#{index + 1}</span>
          <div>
            <div className="text-navy-200 text-sm font-medium">{name}</div>
            <div className="text-navy-500 text-xs">{qualifier}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
