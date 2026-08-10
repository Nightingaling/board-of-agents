"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="error-screen">
      <p className="eyebrow">BOARD / PAUSED</p>
      <h1>The room needs a moment.</h1>
      <p>We couldn&apos;t load the board. Nothing was lost.</p>
      <button type="button" onClick={() => reset()}>Try the board again <span aria-hidden="true">→</span></button>
    </main>
  );
}