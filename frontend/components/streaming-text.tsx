"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface StreamingTextProps {
    text: string;
    speed?: number;
    className?: string;
    onComplete?: () => void;
}

export function StreamingText({
    text,
    speed = 30,
    className = "",
    onComplete,
}: StreamingTextProps) {
    const [displayedText, setDisplayedText] = useState("");
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        setDisplayedText("");
        setIsComplete(false);

        if (!text) return;

        let currentIndex = 0;
        const interval = setInterval(() => {
            currentIndex++;
            setDisplayedText(text.slice(0, currentIndex));

            if (currentIndex >= text.length) {
                clearInterval(interval);
                setIsComplete(true);
                onComplete?.();
            }
        }, speed);

        return () => clearInterval(interval);
    }, [text, speed, onComplete]);

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={text}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className={className}
                id="streaming-text"
            >
                <p className="text-xl md:text-2xl font-light text-center leading-relaxed tracking-wide">
                    <span className="text-foreground">{displayedText}</span>
                    {!isComplete && (
                        <motion.span
                            className="inline-block w-[2px] h-6 bg-amber ml-1 align-middle"
                            animate={{ opacity: [1, 0, 1] }}
                            transition={{ duration: 0.8, repeat: Infinity }}
                        />
                    )}
                </p>
            </motion.div>
        </AnimatePresence>
    );
}
