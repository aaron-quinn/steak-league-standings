import { Link } from 'react-router-dom';
import PageShell from '@/components/PageShell';
import SectionLabel from '@/components/SectionLabel';
import { FUN_SCREENS } from '@/components/fun/FunNav';

// Small line drawings that hint at each screen
const art: Record<string, React.ReactNode> = {
  '/fun/steak-race': (
    <>
      <path
        d="M4 30 C 18 30, 22 10, 36 10 S 56 22, 76 6"
        className="stroke-emerald-400"
      />
      <path
        d="M4 10 C 18 10, 22 28, 36 28 S 56 16, 76 30"
        className="stroke-red-400/80"
      />
      <path d="M4 20 H76" className="stroke-gray-700" strokeDasharray="2 3" />
      <circle cx="76" cy="6" r="3" className="fill-emerald-400 stroke-none" />
    </>
  ),
  '/fun/top-players': (
    <>
      {[30, 24, 19, 15, 12, 10].map((height, index) => (
        <rect
          key={height}
          x={6 + index * 12}
          y={34 - height}
          width="8"
          height={height}
          rx="1.5"
          className={
            index === 0
              ? 'fill-emerald-400 stroke-none'
              : 'fill-gray-700 stroke-none'
          }
        />
      ))}
    </>
  ),
  '/fun/bench': (
    <>
      <path d="M8 18 H72" className="stroke-gray-500" strokeWidth="3" />
      <path d="M8 24 H72" className="stroke-gray-600" strokeWidth="2" />
      <path d="M14 24 V34 M66 24 V34" className="stroke-gray-600" />
      <path d="M14 18 V8 M66 18 V8 M14 8 H66" className="stroke-gray-700" />
      <circle cx="40" cy="12" r="3.5" className="fill-amber-400 stroke-none" />
    </>
  ),
};

export default function FunView() {
  return (
    <PageShell>
      <SectionLabel tone="green">Fun</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        {FUN_SCREENS.map((screen) => (
          <Link
            key={screen.to}
            to={screen.to}
            className="group flex items-center gap-4 rounded-lg border border-gray-800/60 bg-gray-950/30 p-4 sm:flex-col sm:items-start sm:p-5 transition-colors hover:border-gray-700/80 hover:bg-gray-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <svg
              viewBox="0 0 80 40"
              aria-hidden="true"
              className="h-10 w-20 shrink-0 fill-none stroke-2 [stroke-linecap:round] transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:-translate-y-0.5"
            >
              {art[screen.to]}
            </svg>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-semibold text-gray-100">
                {screen.label}
                <span
                  aria-hidden="true"
                  className="ml-1.5 inline-block text-gray-600 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-emerald-400"
                >
                  →
                </span>
              </div>
              <p className="mt-0.5 text-xs sm:text-sm text-gray-500">
                {screen.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
