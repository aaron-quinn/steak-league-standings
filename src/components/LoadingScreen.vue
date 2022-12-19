<template>
  <div
    class="h-screen bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center p-8 antialiased"
    style="height: 100dvh"
  >
    <div
      role="status"
      class="flex flex-col items-center justify-center max-w-lg"
    >
      <img
        class="text-gray-200 animate-spin dark:text-gray-600 fill-blue-600 w-32 h-32 md:w-60 md:h-60"
        src="/steak.svg"
        alt="Steak League"
      />
      <div
        class="text-center mt-8 mb-4 md:mb-6 font-normal text-3xl md:text-4xl text-slate-200"
      >
        Loading Standings...
      </div>
      <p class="text-lg md:text-xl font-light text-slate-300">
        This can take a while due to this site being hosted on a free plan where
        the server needs to wake up.
      </p>
    </div>
  </div>
</template>
