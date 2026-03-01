"use client";

export function TypewriterText({
  text,
  revealedWordCount,
}: {
  text: string;
  revealedWordCount: number;
}) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const visible = words.slice(0, revealedWordCount);

  return <>{visible.join(" ")}</>;
}
