export default function LoadingScreen() {
  return (
    <div
      className="h-screen bg-gradient-to-br from-navy-1000 via-navy-950 to-navy-1000 text-white flex items-center justify-center p-8 antialiased"
      style={{ height: '100dvh' }}
    >
      <div
        role="status"
        className="flex flex-col items-center justify-center max-w-lg"
      >
        <img
          className="animate-pulse w-32 h-32 md:w-60 md:h-60"
          src="/steak.svg"
          alt="Steak League"
        />
        <div className="text-center mt-8 mb-4 md:mb-6 font-semibold text-3xl md:text-4xl text-navy-100">
          Loading Standings...
        </div>
        <p className="text-lg md:text-xl font-light text-navy-400 text-center">
          This can take a while due to this site being hosted on a free plan
          where the server needs to wake up.
        </p>
      </div>
    </div>
  );
}
