"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export function TypewriterText({ text }: { text: string }) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    if (wordIndex < words.length) {
      const currentWord = words[wordIndex] ?? "";
      const delayMs = Math.min(
        360,
        Math.max(120, currentWord.length * 28 + 80),
      );
      const timeout = setTimeout(
        () => setWordIndex((prev) => prev + 1),
        delayMs,
      );
      return () => clearTimeout(timeout);
    }
  }, [wordIndex, words]);

  return (
    <>
      {words.slice(0, wordIndex).join(" ")}
      {wordIndex < words.length && (
        <motion.span
          className="inline-block w-0.5 h-[0.85em] bg-amber ml-1 align-middle"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      )}
    </>
  );
}
