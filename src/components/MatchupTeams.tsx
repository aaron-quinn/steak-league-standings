import clsx from 'clsx';
import TeamMatchup from '@/types/TeamMatchup';
import type { MatchupManager } from '@/types/MatchupManager';
import { splitScore } from '@/utils/format-score';

interface Props {
  matchups: TeamMatchup[][];
  managersMap: Map<string, MatchupManager>;
  currentMatchup: number | null;
  setCurrentMatchup: (matchup: number | null) => void;
}

export default function MatchupTeams({
  matchups,
  managersMap,
  currentMatchup,
  setCurrentMatchup,
}: Props) {
  function selectMatchup(idx: number, matchup: TeamMatchup[]) {
    setCurrentMatchup(idx);
    if (matchup.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    params.set('id', matchup.map((t) => t.franchiseID).join('_'));
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}?${params.toString()}`,
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
      {matchups.map((matchup, idx) => {
        const selected = currentMatchup === idx;
        const topScore = Math.max(...matchup.map((t) => Number(t.score) || 0));
        const tied =
          matchup.length > 1 &&
          matchup.every((t) => (Number(t.score) || 0) === topScore);

        return (
          <button
            type="button"
            key={idx}
            aria-pressed={selected}
            onClick={() => selectMatchup(idx, matchup)}
            className={clsx(
              'flex flex-col gap-1 rounded-lg border px-2.5 py-2 sm:px-3 sm:py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
              selected
                ? 'border-emerald-600/50 bg-emerald-950/30'
                : 'border-gray-800/60 bg-gray-950/30 hover:border-gray-700/80 hover:bg-gray-900/40',
            )}
          >
            {matchup.map((team) => {
              const manager = managersMap.get(team.franchiseID);
              const leading = !tied && (Number(team.score) || 0) === topScore;
              const { int, dec } = splitScore(team.score);
              return (
                <div
                  key={team.franchiseID}
                  className="flex items-baseline justify-between gap-2"
                >
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    {/* Always reserve the slot so names line up across tiles */}
                    <span
                      className={clsx(
                        'w-4 shrink-0 text-right font-mono tabular-nums text-[10px] sm:text-xs',
                        manager?.rank ? 'text-gray-500' : 'text-gray-700',
                      )}
                      title={
                        manager?.rank
                          ? `Official steak rank: ${manager.rank}`
                          : undefined
                      }
                    >
                      {manager?.rank ?? '–'}
                    </span>
                    <span
                      className={clsx(
                        'truncate text-[11px] sm:text-sm',
                        manager?.steak ? 'text-emerald-400' : 'text-gray-300',
                        leading ? 'font-semibold' : 'opacity-70',
                      )}
                    >
                      {manager?.name ?? 'Unknown'}
                    </span>
                  </span>
                  <span
                    className={clsx(
                      'shrink-0 font-mono tabular-nums text-[11px] sm:text-sm',
                      leading ? 'text-gray-100 font-semibold' : 'text-gray-500',
                    )}
                  >
                    {int}
                    <span className="text-[0.8em] opacity-60">.{dec}</span>
                  </span>
                </div>
              );
            })}
          </button>
        );
      })}
    </div>
  );
}
