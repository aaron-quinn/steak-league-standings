interface PlayoffListProps {
  playoffTeams: [string, string][];
}

export default function PlayoffList({ playoffTeams }: PlayoffListProps) {
  return (
    <div className="py-2 antialiased">
      {playoffTeams.map(([qualifier, name], index) => (
        <div key={name} className="py-1.5 px-3 flex items-start gap-2">
          <span className="text-slate-500 text-sm w-5">#{index + 1}</span>
          <div>
            <div className="text-slate-300 text-sm font-normal">{name}</div>
            <div className="text-slate-500 text-xs">{qualifier}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
