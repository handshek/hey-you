"use client";

import { motion } from "framer-motion";
import { Avatar } from "@/components/avatar/Avatar";
import type { GreeterCallStatus } from "@/components/greeter-yolo/types";

interface GreeterStatusScreenProps {
  status: GreeterCallStatus;
  hasApiKey: boolean;
  onActivate: () => void;
  onRetry: () => void;
}

export function GreeterStatusScreen({
  status,
  hasApiKey,
  onActivate,
  onRetry,
}: GreeterStatusScreenProps) {
  if (status === "idle") {
    return (
      <div className="fixed inset-0 z-50 bg-[#0C0A09] text-foreground flex flex-col items-center justify-center">
        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <Avatar state="idle" />
        </motion.div>

        <motion.button
          onClick={onActivate}
          className="relative z-10 mt-8 px-8 py-3 bg-linear-to-r from-amber to-orange-500 text-black font-semibold rounded-full hover:from-amber/90 hover:to-orange-400 transition-all cursor-pointer shadow-lg shadow-amber/20"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Activate Greeter
        </motion.button>

        {!hasApiKey && (
          <motion.p
            className="relative z-10 mt-4 text-red-400 text-xs font-mono"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Missing NEXT_PUBLIC_STREAM_API_KEY
          </motion.p>
        )}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="fixed inset-0 z-50 bg-[#0C0A09] text-foreground flex flex-col items-center justify-center gap-6">
        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Avatar state="sad" />
        </motion.div>

        <motion.p
          className="relative z-10 text-muted-foreground text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Failed to connect. Check your Stream API keys.
        </motion.p>

        <motion.button
          onClick={onRetry}
          className="relative z-10 px-6 py-2 border border-amber/30 text-amber rounded-full hover:bg-amber/10 transition-colors cursor-pointer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          Try Again
        </motion.button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0C0A09] text-foreground flex flex-col items-center justify-center gap-6">
      <motion.div
        className="relative z-10"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <Avatar state="idle" />
      </motion.div>

      <div className="relative z-10 flex items-center gap-3">
        <motion.div
          className="w-4 h-4 border-2 border-amber/30 border-t-amber rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        <span className="text-muted-foreground text-sm font-mono">Connecting...</span>
      </div>
    </div>
  );
}
