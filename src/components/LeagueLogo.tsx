import { Link } from 'react-router-dom';

export default function LeagueLogo() {
  return (
    <Link
      to="/"
      className="flex items-center gap-1.5 sm:gap-2 lg:gap-2.5 shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      aria-label="Steak League home (Official standings)"
    >
      <img
        className="w-5 sm:w-6 lg:w-9"
        src="/steak.svg"
        alt=""
        aria-hidden="true"
      />
      <h1 className="text-gray-50 text-sm sm:text-base lg:text-xl font-semibold tracking-[-0.02em] whitespace-nowrap">
        {/* The icon stands in for "Steak" on phones, freeing room for the
            view switcher */}
        <span className="sr-only sm:not-sr-only">Steak </span>League
      </h1>
    </Link>
  );
}
