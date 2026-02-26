"use client";

import { useState } from "react";
import { Avatar, AvatarState } from "@/components/avatar/Avatar";

export default function AvatarIdlePage() {
  const [faceState, setFaceState] = useState<AvatarState>("idle");

  const toggleState = () => {
    setFaceState((prev) => (prev === "idle" ? "wow" : "idle"));
  };

  return (
    <div
      style={{ background: "#000000" }}
      className="relative flex items-center justify-center min-h-screen w-full overflow-hidden"
    >
      <div className="flex items-center justify-center">
        <Avatar state={faceState} />
      </div>

      <div className="absolute bottom-12 flex flex-col items-center gap-6">
        <button
          onClick={toggleState}
          className="px-8 py-3 rounded-full bg-white/5 border border-white/10 text-white/70 
                     hover:bg-white/10 hover:border-white/20 transition-all duration-300
                     font-mono text-[10px] tracking-[0.2em] uppercase backdrop-blur-sm
                     active:scale-95 active:bg-white/20"
        >
          Toggle Expression:{" "}
          <span className="text-white font-bold">{faceState}</span>
        </button>

        <div className="text-white/20 font-mono text-[9px] tracking-widest uppercase flex items-center gap-3">
          <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
          System Active •{" "}
          {faceState === "idle" ? "Autonomic Blinking" : "Exaggerated State"}
        </div>
      </div>
    </div>
  );
}
