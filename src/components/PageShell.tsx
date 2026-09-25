import LeagueLogo from './LeagueLogo';
import ViewSwitcher from './ViewSwitcher';

interface Props {
  children: React.ReactNode;
  status?: React.ReactNode;
}

// Page frame with the logo and view switcher, shared by the non-standings views
export default function PageShell({ children, status }: Props) {
  return (
    <div className="bg-black min-h-screen py-3 px-2 sm:py-4 sm:px-3 lg:py-8 lg:px-8">
      <div className="w-full max-w-[375px] sm:max-w-6xl mx-auto">
        {/* Header row - logo and view switcher */}
        <div className="flex items-end justify-between lg:justify-start gap-1.5 sm:gap-2 lg:gap-4 mb-3 sm:mb-4 lg:mb-6 max-[350px]:flex-col max-[350px]:items-start">
          <div className="flex h-8 lg:h-10 shrink-0 items-center">
            <LeagueLogo />
          </div>
          <ViewSwitcher />
          {status}
        </div>
        {children}
      </div>
    </div>
  );
}
