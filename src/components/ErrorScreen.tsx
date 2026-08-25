interface Props {
    title?: string;
    message?: string;
  }
  
  export default function ErrorScreen({ title, message }: Props) {
    return (
      <div
        className="h-screen bg-gray-950 text-gray-300 flex items-center justify-center p-8 antialiased"
        style={{ height: '100dvh' }}
      >
        <div
          role="status"
          className="flex flex-col items-center justify-center max-w-lg"
        >
          <div className="text-7xl md:text-9xl opacity-60 mb-2" aria-label="Tombstone" role="img">
            🪦
          </div>
          <div className="text-center mt-8 mb-4 md:mb-6 font-medium text-2xl md:text-3xl text-gray-300">
            {title || 'Something Went Wrong'}
          </div>
          <p className="text-base md:text-lg font-light text-gray-400 text-center">
            {message || 'We were unable to load the standings data. This is probably due to a rate limiting issue. Please try again later.'}
          </p>
        </div>
      </div>
    );
  }
  