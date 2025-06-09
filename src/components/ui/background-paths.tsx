"use client";

import { motion } from "framer-motion";

function FloatingPaths({ position }: { position: number }) {
    const paths = Array.from({ length: 36 }, (_, i) => ({
        id: i,
        d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
            380 - i * 5 * position
        } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
            152 - i * 5 * position
        } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
            684 - i * 5 * position
        } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
        color: `rgba(15,23,42,${0.1 + i * 0.03})`,
        width: 0.5 + i * 0.03,
    }));

    return (
        <div className="absolute inset-0 pointer-events-none">
            <svg
                className="w-full h-full text-slate-950 dark:text-white"
                viewBox="0 0 696 316"
                fill="none"
            >
                <title>Background Paths</title>
                {paths.map((path) => (
                    <motion.path
                        key={path.id}
                        d={path.d}
                        stroke="currentColor"
                        strokeWidth={path.width}
                        strokeOpacity={0.1 + path.id * 0.03}
                        initial={{ pathLength: 0.3, opacity: 0.6 }}
                        animate={{
                            pathLength: 1,
                            opacity: [0.3, 0.6, 0.3],
                            pathOffset: [0, 1, 0],
                        }}
                        transition={{
                            duration: 20 + Math.random() * 10,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "linear",
                        }}
                    />
                ))}
            </svg>
        </div>
    );
}

export function BackgroundPaths({
    title = "Simplified ERP",
    children,
}: {
    title?: string;
    children?: React.ReactNode;
}) {
    const words = title.split(" ");

    return (
        <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-white dark:bg-neutral-950">
            {/* Background Animation */}
            <div className="absolute inset-0 opacity-30">
                <FloatingPaths position={1} />
                <FloatingPaths position={-1} />
            </div>

            {/* Animated Title */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 2 }}
                className="relative z-10 text-center mb-12"
            >
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tighter">
                    {words.map((word, wordIndex) => (
                        <span
                            key={wordIndex}
                            className="inline-block mr-4 last:mr-0"
                        >
                            {word.split("").map((letter, letterIndex) => (
                                <motion.span
                                    key={`${wordIndex}-${letterIndex}`}
                                    initial={{ y: 100, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{
                                        delay:
                                            wordIndex * 0.1 +
                                            letterIndex * 0.03,
                                        type: "spring",
                                        stiffness: 150,
                                        damping: 25,
                                    }}
                                    className="inline-block text-transparent bg-clip-text 
                                    bg-gradient-to-r from-neutral-900 to-neutral-700/80 
                                    dark:from-white dark:to-white/80"
                                >
                                    {letter}
                                </motion.span>
                            ))}
                        </span>
                    ))}
                </h1>
            </motion.div>

            {/* Content Area (for auth form) */}
            <div className="relative z-10 w-full max-w-sm md:max-w-3xl px-6">
                {children}
            </div>
        </div>
    );
} 