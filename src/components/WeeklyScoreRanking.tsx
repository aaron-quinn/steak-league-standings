import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import clsx from 'clsx';
import { useStandingsStore } from '../stores/standings';
import getManagers from '../data/managers';
import { splitScore } from '@/utils/format-score';
import SectionLabel from './SectionLabel';

interface Props {
  projected?: boolean;
}

type RankingItem = { name: string; score: number; current: number };

export default function WeeklyScoreRanking({ projected = false }: Props) {
  const year = useStandingsStore((state) => state.year);
  const standings = useStandingsStore((state) => state.standings);
  const live = useStandingsStore((state) => state.live);

  const ranking = useMemo(() => {
    if (!live) return [];
    const managers = getManagers();

    const list = managers
      .map((manager) => {
        const teamYear = manager.teams[year];
        if (
          !teamYear ||
          !teamYear.teamID ||
          !teamYear.league ||
          !('steak' in teamYear)
        ) {
          return null;
        }

        const id = `${teamYear.league.toLowerCase()}${teamYear.teamID}`;
        const teamData = standings[id];

        if (!teamData) return null;

        const current = teamData.weeklyScore || 0;
        return {
          name: manager.name,
          current,
          score: current + (projected ? (teamData.projectedRemaining ?? 0) : 0),
        };
      })
      .filter((item): item is RankingItem => item !== null);

    list.sort((a, b) => b.score - a.score);

    return list;
  }, [year, standings, live, projected]);

  const listRef = useRef<HTMLDivElement>(null);
  const rowPositions = useRef<Map<string, number>>(new Map());
  const rowAnimations = useRef<Animation[]>([]);

  // Row offsets from the top of the list, keyed by team
  const measureRows = () => {
    const positions = new Map<string, number>();
    const list = listRef.current;
    if (!list) return positions;
    const listTop = list.getBoundingClientRect().top;
    list.querySelectorAll<HTMLElement>('[data-ranking-team]').forEach((row) => {
      const team = row.dataset.rankingTeam;
      if (team) positions.set(team, row.getBoundingClientRect().top - listTop);
    });
    return positions;
  };

  // Slide rows from their old spot to their new one when the order changes,
  // such as switching to Projected, the same way the standings rows move
  useLayoutEffect(() => {
    rowAnimations.current.forEach((animation) => animation.cancel());
    rowAnimations.current = [];

    const previous = rowPositions.current;
    const next = measureRows();
    rowPositions.current = next;
    if (previous.size === 0) return;

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    listRef.current
      ?.querySelectorAll<HTMLElement>('[data-ranking-team]')
      .forEach((row) => {
        const team = row.dataset.rankingTeam ?? '';
        const from = previous.get(team);
        const to = next.get(team);
        if (from === undefined || to === undefined) return;
        const deltaY = from - to;
        if (Math.abs(deltaY) < 1) return;

        row.style.zIndex = '1';
        const animation = row.animate(
          reduceMotion
            ? [{ opacity: 0.65 }, { opacity: 1 }]
            : [
                { transform: `translateY(${deltaY}px)` },
                { transform: 'translateY(0px)' },
              ],
          {
            duration: reduceMotion ? 150 : 240,
            easing: reduceMotion
              ? 'cubic-bezier(0.23, 1, 0.32, 1)'
              : 'cubic-bezier(0.77, 0, 0.175, 1)',
          },
        );
        const clearStacking = () => {
          row.style.zIndex = '';
        };
        animation.onfinish = clearStacking;
        animation.oncancel = clearStacking;
        rowAnimations.current.push(animation);
      });
  }, [ranking]);

  // Keep the stored offsets current when the layout changes size, so a
  // resize between updates doesn't read as rows moving
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(() => {
      if (rowAnimations.current.some((a) => a.playState === 'running')) return;
      rowPositions.current = measureRows();
    });
    observer.observe(list);
    return () => {
      observer.disconnect();
      rowAnimations.current.forEach((animation) => animation.cancel());
    };
  }, [ranking.length > 0]);

  if (ranking.length === 0) return null;

  const topScore = ranking[0].score;

  // Split at the steak line the same way the standings do: the top half
  // eats, the bottom half buys, and an odd team out buys their own.
  const selfBuyer = ranking.length % 2 !== 0;
  const steakLine = selfBuyer
    ? Math.floor(ranking.length / 2)
    : Math.floor(ranking.length / 2) - 1;
  const groups: { tone: Tone; start: number; items: RankingItem[] }[] = [
    { tone: 'eater', start: 0, items: ranking.slice(0, steakLine) },
    ...(selfBuyer
      ? [
          {
            tone: 'self-buyer' as const,
            start: steakLine,
            items: ranking.slice(steakLine, steakLine + 1),
          },
        ]
      : []),
    {
      tone: 'buyer',
      start: selfBuyer ? steakLine + 1 : steakLine,
      items: ranking.slice(selfBuyer ? steakLine + 1 : steakLine),
    },
  ];

  return (
    <section aria-label="Weekly leaders">
      <SectionLabel>
        {projected ? 'Projected Weekly Leaders' : 'Weekly Leaders'}
      </SectionLabel>
      <div ref={listRef} className="space-y-1.5">
        {groups
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <ol
              key={group.tone}
              start={group.start + 1}
              aria-label={toneStyles[group.tone].label}
              className={clsx(
                'rounded-lg border p-1 sm:p-1.5 space-y-px',
                toneStyles[group.tone].border,
              )}
            >
              {group.items.map((item, i) => (
                <RankingRow
                  key={item.name}
                  item={item}
                  rank={group.start + i + 1}
                  tone={group.tone}
                  topScore={topScore}
                  projected={projected}
                />
              ))}
            </ol>
          ))}
      </div>
    </section>
  );
}

type Tone = 'eater' | 'self-buyer' | 'buyer';

const toneStyles: Record<
  Tone,
  { label: string; border: string; bar: string; leaderBar: string }
> = {
  eater: {
    label: 'Eaters',
    border: 'border-emerald-700/40',
    bar: 'bg-emerald-500/[0.07]',
    leaderBar: 'bg-emerald-500/[0.16]',
  },
  'self-buyer': {
    label: 'Self buyer',
    border: 'border-gray-700/50',
    bar: 'bg-gray-400/[0.07]',
    leaderBar: 'bg-gray-400/[0.07]',
  },
  buyer: {
    label: 'Buyers',
    border: 'border-red-800/40',
    bar: 'bg-red-500/[0.07]',
    leaderBar: 'bg-red-500/[0.07]',
  },
};

interface RankingRowProps {
  item: RankingItem;
  rank: number;
  tone: Tone;
  topScore: number;
  projected: boolean;
}

function RankingRow({
  item,
  rank,
  tone,
  topScore,
  projected,
}: RankingRowProps) {
  const { int, dec } = splitScore(item.score);
  const scored = item.score > 0;
  const leader = scored && item.score === topScore;
  // Share of the week's high score, drawn as a bar behind the row
  const share = topScore > 0 ? (item.score / topScore) * 100 : 0;
  const styles = toneStyles[tone];

  return (
    <li
      data-ranking-team={item.name}
      className="relative flex items-center justify-between gap-x-4 rounded px-1 sm:px-1.5 py-1 text-xs sm:text-sm"
      title={
        projected
          ? `${item.current.toFixed(2)} current + ${(item.score - item.current).toFixed(2)} projected remaining`
          : undefined
      }
    >
      {scored && (
        <span
          aria-hidden="true"
          className={clsx(
            'absolute inset-y-0 left-0 rounded transition-[width] duration-500 ease-out motion-reduce:transition-none',
            leader ? styles.leaderBar : styles.bar,
          )}
          style={{ width: `${share}%` }}
        />
      )}
      <div className="relative flex min-w-0 items-center gap-2.5 sm:gap-3">
        <span className="w-4 sm:w-5 shrink-0 text-right font-mono tabular-nums text-[10px] sm:text-xs text-gray-600">
          {rank}
        </span>
        <span
          className={clsx(
            'truncate',
            leader
              ? 'text-gray-100 font-medium'
              : scored
                ? 'text-gray-300'
                : 'text-gray-600',
          )}
        >
          {item.name}
        </span>
      </div>
      <span
        className={clsx(
          'relative shrink-0 font-mono tabular-nums',
          leader
            ? 'text-emerald-400 font-semibold'
            : scored
              ? 'text-gray-300'
              : 'text-gray-700',
        )}
      >
        {int}
        <span className="text-[0.8em] opacity-60">.{dec}</span>
      </span>
    </li>
  );
}
