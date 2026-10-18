import clsx from 'clsx';

// Roto points with a sign, colored by direction; the label says what it is
export function signed(points: number) {
  const rounded = Math.round(points * 10) / 10;
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded).toFixed(1)}`;
}

export default function RowValue({
  value,
  label,
  sign = false,
}: {
  value: number;
  label?: string;
  sign?: boolean;
}) {
  return (
    <span
      className={clsx('nba-row-value', sign && { 'nba-good': value >= 0.05, 'nba-bad': value <= -0.05 })}
    >
      {sign ? signed(value) : value.toFixed(1)}
      {label && <small>{label}</small>}
    </span>
  );
}
