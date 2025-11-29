interface PlayoffListProps {
  playoffTeams: [string, string][];
  league: string;
}

export default function PlayoffList({ playoffTeams, league }: PlayoffListProps) {
  return (
    <div className="bg-slate-800 rounded-md flex-grow antialiased">
      <div className="py-3 px-4 bg-slate-700 text-slate-300 rounded-t-md text-lg font-bold">
        {league} Playoffs
      </div>
      <div className="py-2">
        {playoffTeams.map(([qualifier, name]) => (
          <div key={name} className="py-2 px-4">
            <div className="text-slate-300 text-lg font-normal">{name}</div>
            <div className="text-slate-400 text-sm">{qualifier}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
