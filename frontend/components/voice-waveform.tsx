"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

interface VoiceWaveformProps {
    isActive?: boolean;
    barCount?: number;
}

export function VoiceWaveform({
    isActive = false,
    barCount = 32,
}: VoiceWaveformProps) {
    const bars = useMemo(() => {
        return Array.from({ length: barCount }, (_, i) => ({
            id: i,
            delay: Math.random() * 0.5,
            baseHeight: 4 + Math.random() * 8,
        }));
    }, [barCount]);

    return (
        <div
            className="flex items-center justify-center gap-[2px] h-16"
            id="voice-waveform"
        >
            {bars.map((bar) => (
                <motion.div
                    key={bar.id}
                    className="w-[3px] rounded-full"
                    style={{
                        background: isActive
                            ? "linear-gradient(to top, #FB923C, #fdba74)"
                            : "#292524",
                    }}
                    animate={
                        isActive
                            ? {
                                height: [bar.baseHeight, 20 + Math.random() * 40, bar.baseHeight],
                            }
                            : { height: bar.baseHeight }
                    }
                    transition={
                        isActive
                            ? {
                                duration: 0.4 + Math.random() * 0.4,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: bar.delay,
                            }
                            : { duration: 0.5 }
                    }
                />
            ))}
        </div>
    );
}
