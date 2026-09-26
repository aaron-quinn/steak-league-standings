import clsx from 'clsx';
import { positionLabel } from '@/utils/week-players';

const positionColors: Record<string, string> = {
  QB: 'bg-rose-500/15 text-rose-300',
  RB: 'bg-emerald-500/15 text-emerald-300',
  WR: 'bg-sky-500/15 text-sky-300',
  TE: 'bg-amber-500/15 text-amber-300',
  K: 'bg-gray-500/15 text-gray-300',
};
const idpColor = 'bg-violet-500/15 text-violet-300';

// A player's position as a small colored tag, with team kickers shown as K
export default function PositionBadge({ position }: { position: string }) {
  const label = positionLabel(position);
  return (
    <span
      className={clsx(
        'shrink-0 rounded px-1 py-px font-mono text-[9px] sm:text-[10px] font-semibold',
        positionColors[label] ?? idpColor,
      )}
    >
      {label}
    </span>
  );
}
