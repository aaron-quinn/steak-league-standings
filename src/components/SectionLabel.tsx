import clsx from 'clsx';

const tones = {
  gray: {
    rule: 'from-gray-600/35',
    text: 'text-gray-500',
  },
  // Matches the Eaters divider in the standings
  green: {
    rule: 'from-emerald-600/35',
    text: 'text-emerald-600/65',
  },
};

interface Props {
  children: React.ReactNode;
  tone?: keyof typeof tones;
}

// Uppercase label centered between two fading hairlines, matching the
// Eaters / Buyers dividers in the standings.
export default function SectionLabel({ children, tone = 'gray' }: Props) {
  const styles = tones[tone];
  return (
    <div className="flex items-center gap-2 mb-2">
      <div
        className={clsx(
          'h-px flex-1 bg-gradient-to-r to-transparent',
          styles.rule,
        )}
      />
      <span
        className={clsx(
          'text-[11px] uppercase tracking-widest font-medium',
          styles.text,
        )}
      >
        {children}
      </span>
      <div
        className={clsx(
          'h-px flex-1 bg-gradient-to-l to-transparent',
          styles.rule,
        )}
      />
    </div>
  );
}
