"use client";

import { useRef, useState } from "react";

const LETTERS = ["l", "y", "n", "k", "a"];

// aeza-style keycap tiles, all letters boxed. hovering starts one hop wave
// that always plays to the end: leaving mid-wave no longer snaps the tiles
// back, re-entering does not restart until the wave finished
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const [waving, setWaving] = useState(false);
  const finished = useRef(0);

  const tile = `tile inline-flex items-center justify-center rounded-[10px] border border-line bg-background font-semibold text-foreground shadow-[0_2px_0_rgba(10,11,13,0.08)] ${
    size === "lg" ? "h-9 w-9 text-lg" : "h-8 w-8 text-base"
  }`;

  return (
    <span
      className={`logo-tiles inline-flex items-center gap-1 ${waving ? "waving" : ""}`}
      aria-label="lynka"
      onMouseEnter={() => setWaving(true)}
      onAnimationEnd={() => {
        finished.current += 1;
        if (finished.current >= LETTERS.length) {
          finished.current = 0;
          setWaving(false);
        }
      }}
    >
      {LETTERS.map((letter, i) => (
        <span key={i} className={tile} aria-hidden>
          {letter}
        </span>
      ))}
    </span>
  );
}
