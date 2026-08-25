interface Props {
  title?: string;
  message?: string;
}

export default function MatchupsPlaceholder({ title, message }: Props) {
  return (
    <div className="rounded-lg border border-gray-800/60 bg-gray-950/30 px-6 py-16 sm:py-24">
      <div className="flex flex-col items-center justify-center max-w-md mx-auto">
        <img
          className="w-24 h-24 md:w-32 md:h-32 opacity-30"
          src="/steak.svg"
          alt=""
          aria-hidden="true"
        />
        <div className="text-center mt-6 mb-3 font-medium text-xl md:text-2xl text-gray-300">
          {title || 'No Matchups Yet'}
        </div>
        <p className="text-sm md:text-base font-light text-gray-400 text-center">
          {message ||
            'Live matchups appear once the season kicks off and the first games are underway.'}
        </p>
      </div>
    </div>
  );
}
