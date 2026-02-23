"use client";

import { motion, type Variants } from "framer-motion";

type BotState = "idle" | "detecting" | "speaking";

interface BotFaceProps {
    state?: BotState;
    size?: number;
}

const pulseVariants: Variants = {
    idle: {
        scale: [1, 1.02, 1],
        transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
    },
    detecting: {
        scale: [1, 1.05, 1],
        transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
    },
    speaking: {
        scale: [1, 1.08, 1],
        transition: { duration: 0.6, repeat: Infinity, ease: "easeInOut" },
    },
};

const glowVariants: Variants = {
    idle: {
        opacity: [0.3, 0.5, 0.3],
        transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
    },
    detecting: {
        opacity: [0.4, 0.8, 0.4],
        transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
    },
    speaking: {
        opacity: [0.5, 1, 0.5],
        transition: { duration: 0.6, repeat: Infinity, ease: "easeInOut" },
    },
};

const leftEyeVariants: Variants = {
    idle: {
        scaleY: [1, 1, 0.1, 1, 1],
        transition: {
            duration: 4,
            repeat: Infinity,
            times: [0, 0.45, 0.5, 0.55, 1],
        },
    },
    detecting: {
        scaleY: 1,
        scale: 1.15,
        transition: { duration: 0.3 },
    },
    speaking: {
        scaleY: [1, 0.8, 1],
        transition: { duration: 0.4, repeat: Infinity, ease: "easeInOut" },
    },
};

const rightEyeVariants: Variants = {
    idle: {
        scaleY: [1, 1, 0.1, 1, 1],
        transition: {
            duration: 4,
            repeat: Infinity,
            times: [0, 0.45, 0.5, 0.55, 1],
            delay: 0.05,
        },
    },
    detecting: {
        scaleY: 1,
        scale: 1.15,
        transition: { duration: 0.3 },
    },
    speaking: {
        scaleY: [1, 0.8, 1],
        transition: {
            duration: 0.4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.1,
        },
    },
};

const mouthVariants: Variants = {
    idle: {
        d: "M 35 55 Q 50 60 65 55",
        transition: { duration: 2, repeat: Infinity, repeatType: "reverse" },
    },
    detecting: {
        d: "M 35 52 Q 50 55 65 52",
        transition: { duration: 0.3 },
    },
    speaking: {
        d: [
            "M 35 52 Q 50 65 65 52",
            "M 35 52 Q 50 58 65 52",
            "M 35 52 Q 50 68 65 52",
            "M 35 52 Q 50 55 65 52",
        ],
        transition: { duration: 0.8, repeat: Infinity, ease: "easeInOut" },
    },
};

export function BotFace({ state = "idle", size = 200 }: BotFaceProps) {
    return (
        <div className="relative flex items-center justify-center" id="bot-face">
            {/* Outer glow ring */}
            <motion.div
                className="absolute rounded-full"
                style={{
                    width: size * 1.4,
                    height: size * 1.4,
                    background:
                        "radial-gradient(circle, rgba(251,146,60,0.15) 0%, transparent 70%)",
                }}
                variants={glowVariants}
                animate={state}
            />

            {/* Main face container */}
            <motion.div
                className="relative rounded-full border border-amber/20 flex items-center justify-center"
                style={{
                    width: size,
                    height: size,
                    background:
                        "radial-gradient(circle at 40% 35%, #292524 0%, #1c1917 50%, #0C0A09 100%)",
                    boxShadow:
                        "0 0 40px rgba(251,146,60,0.1), inset 0 0 30px rgba(0,0,0,0.3)",
                }}
                variants={pulseVariants}
                animate={state}
            >
                {/* SVG face */}
                <svg
                    viewBox="0 0 100 100"
                    fill="none"
                    style={{ width: size * 0.7, height: size * 0.7 }}
                >
                    {/* Left eye */}
                    <motion.ellipse
                        cx="38"
                        cy="40"
                        rx="5"
                        ry="6"
                        fill="#FB923C"
                        variants={leftEyeVariants}
                        animate={state}
                    />
                    {/* Right eye */}
                    <motion.ellipse
                        cx="62"
                        cy="40"
                        rx="5"
                        ry="6"
                        fill="#FB923C"
                        variants={rightEyeVariants}
                        animate={state}
                    />
                    {/* Mouth */}
                    <motion.path
                        stroke="#FB923C"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        fill="none"
                        variants={mouthVariants}
                        animate={state}
                    />
                </svg>
            </motion.div>
        </div>
    );
}
