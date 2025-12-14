interface Props {
  title?: string;
}

export default function LoadingScreen({ title }: Props) {
  return (
    <div
      className="h-screen bg-gray-950 text-gray-300 flex items-center justify-center p-8 antialiased"
      style={{ height: '100dvh' }}
    >
      <div
        role="status"
        className="flex flex-col items-center justify-center max-w-lg"
      >
        <img
          className="animate-spin w-32 h-32 md:w-60 md:h-60 opacity-60"
          src="/steak.svg"
          alt="Steak League"
        />
        <div className="text-center mt-8 mb-4 md:mb-6 font-medium text-2xl md:text-3xl text-gray-300">
          {title || 'Loading Standings...'}
        </div>
        <p className="text-base md:text-lg font-light text-gray-400 text-center">
          This can take a while due to this site being hosted on a free plan
          where the server needs to wake up.
        </p>
      </div>
    </div>
  );
}
