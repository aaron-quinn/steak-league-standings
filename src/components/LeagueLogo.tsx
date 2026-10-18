import SportSwitch from './SportSwitch';

// The logo opens the league menu; NFL in it leads back to the standings
export default function LeagueLogo() {
  return (
    <SportSwitch
      current="nfl"
      className="z-30 shrink-0"
      triggerClassName="-mx-1.5 flex h-9 lg:h-11 items-center gap-1.5 sm:gap-2 lg:gap-2.5 rounded-lg px-1.5 text-gray-500 transition-colors hover:bg-white/[0.04] hover:text-gray-300 aria-expanded:bg-white/[0.06] aria-expanded:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      menuClassName="flex w-52 flex-col gap-0.5 rounded-xl border border-gray-800 bg-gray-950 p-1.5 shadow-2xl shadow-black/70"
      itemClassName="flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-900 hover:text-gray-100 aria-[current=true]:text-gray-50 [&>span]:flex-1 [&>svg:last-child]:text-emerald-400 focus-visible:outline-none focus-visible:bg-gray-900 focus-visible:text-gray-100"
    >
      <img
        className="w-5 sm:w-6 lg:w-9"
        src="/steak.svg"
        alt=""
        aria-hidden="true"
      />
      <span className="text-gray-50 text-sm sm:text-base lg:text-xl font-semibold tracking-[-0.02em] whitespace-nowrap">
        {/* The icon stands in for "Steak" on phones, freeing room for the
            view switcher */}
        <span className="sr-only sm:not-sr-only">Steak </span>League
      </span>
    </SportSwitch>
  );
}
