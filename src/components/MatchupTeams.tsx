import TeamMatchup from '@/types/TeamMatchup';

interface Props {
  matchups: TeamMatchup[][];
  managersMap: Map<
    string,
    { id: string; name: string; teamID: string; steak: boolean }
  >;
  currentMatchup: number | null;
  setCurrentMatchup: (matchup: number | null) => void;
}

export default function MatchupTeams({
  matchups,
  managersMap,
  currentMatchup,
  setCurrentMatchup,
}: Props) {
  function TeamRow({ team }: { team: TeamMatchup }) {
    const manager = managersMap.get(team.franchiseID);
    return (
      <div className="flex flex-row justify-between sm:gap-x-6">
        <div
          className={`text-[10px] leading-tight sm:text-xs font-bold ${
            manager?.steak ? 'text-blue-400' : 'text-gray-100'
          }`}
        >
          {manager?.name}
        </div>
        <div className="text-[10px] leading-tight sm:text-xs text-gray-100 font-bold">
          {Number(team.score).toFixed(1)}
          {team.yetToPlay === 0 && ' F'}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-4">
      {matchups.map((matchup, idx) => (
        <button
          type="button"
          key={idx}
          className={`bg-gray-900/80 rounded-lg p-2 sm:p-4 flex flex-col gap-y-2 min-w-[140px] sm:min-w-[200px] text-left${currentMatchup === idx ? ' ring-2 ring-blue-400' : ''}`}
          onClick={() => {
            setCurrentMatchup(idx);
            if (matchup.length >= 2) {
              const team1Id = matchup[0].franchiseID;
              const team2Id = matchup[1].franchiseID;
              const params = new URLSearchParams(window.location.search);
              params.set('id', `${team1Id}_${team2Id}`);
              window.history.replaceState(
                {},
                '',
                `${window.location.pathname}?${params.toString()}`,
              );
            } else if (matchup.length === 1) {
              const team1Id = matchup[0].franchiseID;
              const params = new URLSearchParams(window.location.search);
              params.set('id', `${team1Id}`);
              window.history.replaceState(
                {},
                '',
                `${window.location.pathname}?${params.toString()}`,
              );
            }
          }}
        >
          {matchup.map((team, tIdx) => (
            <TeamRow key={tIdx} team={team} />
          ))}
        </button>
      ))}
    </div>
  );
}
