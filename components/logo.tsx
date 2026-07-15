// aeza-style keycap tiles, all letters boxed. hover makes them hop in a wave,
// keyframes live in globals.css (.logo-tiles / .tile)
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const tile = `tile inline-flex items-center justify-center rounded-[10px] border border-line bg-background font-semibold text-foreground shadow-[0_2px_0_rgba(10,11,13,0.08)] ${
    size === "lg" ? "h-9 w-9 text-lg" : "h-8 w-8 text-base"
  }`;
  return (
    <span className="logo-tiles inline-flex items-center gap-1" aria-label="lynka">
      {["l", "y", "n", "k", "a"].map((letter, i) => (
        <span key={i} className={tile} aria-hidden>
          {letter}
        </span>
      ))}
    </span>
  );
}
