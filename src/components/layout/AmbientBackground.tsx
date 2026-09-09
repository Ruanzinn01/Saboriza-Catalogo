export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-24 h-72 w-[34rem] -translate-x-1/2 rounded-full bg-forest-500/15 blur-3xl" />
      <div className="absolute -right-32 top-1/3 h-80 w-80 rounded-full bg-gold-500/10 blur-3xl" />
      <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-forest-600/10 blur-3xl" />
    </div>
  );
}
