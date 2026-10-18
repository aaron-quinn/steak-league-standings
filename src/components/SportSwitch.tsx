import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Basketball from '../nba/components/Basketball';

const SPORTS = [
  {
    key: 'nfl',
    label: 'NFL',
    to: '/',
    icon: <img src="/steak.svg" alt="" aria-hidden="true" width={22} />,
  },
  { key: 'nba', label: 'NBA', to: '/nba', icon: <Basketball size={22} /> },
] as const;

interface Props {
  current: (typeof SPORTS)[number]['key'];
  // The logo; the whole thing opens the menu
  children: React.ReactNode;
  // Where the current league's item goes, if not its default home
  currentTo?: string;
  // Each league styles the pieces in its own look
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  itemClassName?: string;
}

const Chevron = () => (
  <svg
    className="league-chevron"
    width="12"
    height="12"
    viewBox="0 0 12 12"
    aria-hidden="true"
  >
    <path
      d="M2.5 4.5 6 8l3.5-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Check = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <path
      d="m3 7.5 2.5 2.5L11 4.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// The logo and a chevron, opening a menu of the leagues to switch between.
// The menu stays mounted so it can animate out; see .league-menu in index.css.
export default function SportSwitch({
  current,
  children,
  currentTo,
  className,
  triggerClassName,
  menuClassName,
  itemClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const openedByKeyboard = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    // Start keyboard users on the league they're in
    if (openedByKeyboard.current) {
      rootRef.current
        ?.querySelector<HTMLElement>('.league-menu [aria-current]')
        ?.focus({ preventScroll: true });
    }
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={className} style={{ position: 'relative' }}>
      {/* The logo is the page heading, so the button sits inside the h1 */}
      <h1 style={{ margin: 0, font: 'inherit' }}>
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={(e) => {
            // Enter and Space fire clicks with no pointer behind them
            openedByKeyboard.current = e.detail === 0;
            setOpen((o) => !o);
          }}
          className={triggerClassName}
        >
          {children}
          <Chevron />
        </button>
      </h1>
      <nav
        id={menuId}
        aria-label="League"
        data-open={open}
        className={`league-menu ${menuClassName ?? ''}`}
      >
        {SPORTS.map((sport) => {
          const active = sport.key === current;
          return (
            <Link
              key={sport.key}
              to={active && currentTo ? currentTo : sport.to}
              aria-current={active ? 'true' : undefined}
              tabIndex={open ? undefined : -1}
              onClick={() => setOpen(false)}
              className={itemClassName}
            >
              {sport.icon}
              <span>{sport.label}</span>
              {active && <Check />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
