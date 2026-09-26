// A figure in a nugget's running text
export function Num({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-gray-100">{children}</span>;
}

export interface Nugget {
  key: string;
  emoji: string;
  title: string;
  body: React.ReactNode;
}

// Fun facts as a list, each led by its emoji and title
export function NuggetList({ nuggets }: { nuggets: Nugget[] }) {
  return (
    <ul className="space-y-3 text-xs sm:text-sm leading-relaxed text-gray-400">
      {nuggets.map((nugget) => (
        <li key={nugget.key} className="flex gap-2.5">
          <span aria-hidden="true" className="w-5 shrink-0 text-center">
            {nugget.emoji}
          </span>
          <p>
            <span className="font-medium text-gray-200">{nugget.title}:</span>{' '}
            {nugget.body}
          </p>
        </li>
      ))}
    </ul>
  );
}
