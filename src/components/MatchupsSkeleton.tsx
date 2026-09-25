const SKELETON_CARDS = 8;
const SKELETON_STARTERS = 9;
const SKELETON_BENCH = 6;

const bar = 'rounded bg-gray-800/80';

function Label() {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="h-px flex-1 bg-gray-800/60" />
      <div className={`h-2.5 w-14 ${bar}`} />
      <div className="h-px flex-1 bg-gray-800/60" />
    </div>
  );
}

function MatchupCardSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-gray-800/60 bg-gray-950/30 px-2.5 py-2 sm:px-3 sm:py-2.5">
      {[0, 1].map((row) => (
        <div key={row} className="flex items-center justify-between gap-2">
          <div className={`h-3 sm:h-4 w-2/3 ${bar}`} />
          <div className={`h-3 sm:h-4 w-8 ${bar}`} />
        </div>
      ))}
      <div className={`h-2 sm:h-2.5 w-10 ${bar}`} />
    </div>
  );
}

function PlayerListSkeleton({
  rows,
  alignRight,
}: {
  rows: number;
  alignRight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-800/60 bg-gray-950/30 divide-y divide-gray-800/40">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 sm:gap-3 px-2 py-1.5 sm:px-3 sm:py-2 ${
            alignRight ? 'flex-row-reverse' : ''
          }`}
        >
          <div className={`hidden sm:block h-2.5 w-7 ${bar}`} />
          <div
            className={`flex flex-1 flex-col gap-1.5 ${alignRight ? 'items-end' : ''}`}
          >
            <div className={`h-3 sm:h-3.5 w-4/5 ${bar}`} />
            <div className={`h-2.5 sm:h-3 w-1/2 ${bar}`} />
          </div>
          <div className={`h-3 sm:h-4 w-6 ${bar}`} />
        </div>
      ))}
    </div>
  );
}

function ScoreboardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-800/60 bg-gray-950/30 px-3 py-3 sm:px-5 sm:py-5 mb-4 lg:mb-6">
      <div className="flex items-center gap-3 sm:gap-8">
        {[false, true].map((alignRight) => (
          <div
            key={String(alignRight)}
            className={`flex flex-1 items-center justify-between gap-2 sm:gap-4 ${
              alignRight ? 'flex-row-reverse' : ''
            }`}
          >
            <div
              className={`flex flex-col gap-1.5 ${alignRight ? 'items-end' : ''}`}
            >
              <div className={`h-4 sm:h-6 w-20 sm:w-36 ${bar}`} />
              <div className={`h-2.5 sm:h-3 w-14 sm:w-24 ${bar}`} />
            </div>
            <div className={`h-6 sm:h-9 w-12 sm:w-24 ${bar}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MatchupsSkeleton() {
  return (
    <div className="motion-safe:animate-pulse" role="status">
      <span className="sr-only">Loading matchups…</span>
      <div aria-hidden="true" className="grid grid-cols-1 gap-6 lg:gap-8">
        <div>
          <Label />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {Array.from({ length: SKELETON_CARDS }).map((_, i) => (
              <MatchupCardSkeleton key={i} />
            ))}
          </div>
        </div>
        <div>
          <ScoreboardSkeleton />
          <Label />
          <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
            <PlayerListSkeleton rows={SKELETON_STARTERS} />
            <PlayerListSkeleton rows={SKELETON_STARTERS} alignRight />
          </div>
          <div className="mt-4 lg:mt-6">
            <Label />
            <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
              <PlayerListSkeleton rows={SKELETON_BENCH} />
              <PlayerListSkeleton rows={SKELETON_BENCH} alignRight />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
