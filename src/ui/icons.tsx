import type { ReactNode } from "react";

function Icon({ children, viewBox = "0 0 24 24" }: { children: ReactNode; viewBox?: string }) {
  return <svg viewBox={viewBox} aria-hidden="true" focusable="false">{children}</svg>;
}

export function PlayIcon() {
  return <Icon><path d="M8 5.4v13.2L19 12z" /></Icon>;
}

export function PauseIcon() {
  return <Icon><path d="M8.4 5h2.7v14H8.4zM12.9 5h2.7v14h-2.7z" /></Icon>;
}

export function SoundIcon() {
  return (
    <Icon>
      <path d="M9.1 17.1V5.2L19 3.1v11.6" />
      <path d="M9.1 8.8 19 6.7" />
      <ellipse cx="6.3" cy="17.7" rx="2.8" ry="2.1" />
      <ellipse cx="16.2" cy="15.3" rx="2.8" ry="2.1" />
    </Icon>
  );
}

export function SlidersIcon() {
  return (
    <Icon>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="2.1" />
      <circle cx="15.5" cy="12" r="2.1" />
      <circle cx="7.5" cy="17" r="2.1" />
    </Icon>
  );
}

export function DismissIcon() {
  return <Icon><path d="M10 6.5 15.5 12 10 17.5" /></Icon>;
}

export function ResetIcon() {
  return <Icon viewBox="0 0 16 16"><path d="M3.1 6V3.1M3.1 6H6M3.5 5.4a5 5 0 1 1-.4 4.7" /></Icon>;
}
