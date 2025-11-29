export default function LeagueLogo() {
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <img
        className="w-6 lg:w-10 opacity-70"
        src="/steak.svg"
        alt="Steak League"
      />
      <h1 className="text-blue-100 text-base lg:text-xl font-medium tracking-wide whitespace-nowrap">
        Steak League
      </h1>
    </div>
  );
}
