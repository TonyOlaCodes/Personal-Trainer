"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import { X, ChevronRight, Check, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
    targetId: string;
    title: string;
    description: string;
    position: "top" | "bottom" | "left" | "right" | "center";
}

interface WalkthroughProps {
    steps: Step[];
    onComplete: () => void;
}

export function Walkthrough({ steps, onComplete }: WalkthroughProps) {
    const [currentIdx, setCurrentIdx] = useState(-1);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0 });

    const currentStep = currentIdx === -1 ? null : steps[currentIdx];

    const updateCoords = () => {
        if (currentIdx === -1) return;
        const target = document.getElementById(steps[currentIdx].targetId);
        if (target) {
            const rect = target.getBoundingClientRect();
            setCoords({
                top: rect.top + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width,
                height: rect.height
            });
            target.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    };

    useLayoutEffect(() => {
        updateCoords();
        window.addEventListener("resize", updateCoords);
        return () => window.removeEventListener("resize", updateCoords);
    }, [currentIdx]);

    if (currentIdx === -1) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
                <div className="bg-surface-card max-w-sm rounded-[2.5rem] p-8 text-center space-y-6 border border-brand-500/30 shadow-glow-brand ring-1 ring-white/10 animate-slide-up">
                    <div className="w-20 h-20 bg-gradient-brand rounded-3xl flex items-center justify-center mx-auto shadow-glow-brand rotate-3">
                        <Zap className="w-10 h-10 text-white animate-pulse" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-fg tracking-tighter uppercase italic">Welcome Aboard!</h2>
                        <p className="text-sm text-fg-muted mt-3 leading-relaxed">
                            Your access has been granted. Let&apos;s take a 30-second tour of your new high-performance dashboard.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 pt-2">
                        <button 
                            onClick={() => setCurrentIdx(0)}
                            className="btn-primary h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-glow-brand"
                        >
                            Start the Tour
                        </button>
                        <button 
                            onClick={onComplete}
                            className="text-[10px] font-black uppercase tracking-[0.2em] text-fg-subtle hover:text-fg transition-colors"
                        >
                            Skip & Explore
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
            {/* Spotlight Overlay */}
            <div 
                className="absolute inset-0 bg-black/70 transition-all duration-500"
                style={{
                    clipPath: `polygon(
                        0% 0%, 0% 100%, 
                        ${coords.left}px 100%, 
                        ${coords.left}px ${coords.top}px, 
                        ${coords.left + coords.width}px ${coords.top}px, 
                        ${coords.left + coords.width}px ${coords.top + coords.height}px, 
                        ${coords.left}px ${coords.top + coords.height}px, 
                        ${coords.left}px 100%, 
                        100% 100%, 100% 0%
                    )`
                }}
            />

            {/* Step Card */}
            <div 
                className="absolute pointer-events-auto w-72 bg-surface-elevated rounded-3xl p-6 border border-brand-500/30 shadow-modal animate-slide-up transition-all duration-500 ease-spring"
                style={{
                    top: steps[currentIdx].position === "bottom" 
                        ? coords.top + coords.height + 20 
                        : steps[currentIdx].position === "right" || steps[currentIdx].position === "left"
                            ? coords.top + coords.height / 2
                            : coords.top - 20,
                    left: steps[currentIdx].position === "right"
                        ? coords.left + coords.width + 20
                        : steps[currentIdx].position === "left"
                            ? coords.left - 20
                            : coords.left + coords.width / 2,
                    transform: steps[currentIdx].position === "bottom" 
                        ? "translateX(-50%)" 
                        : steps[currentIdx].position === "right"
                            ? "translateY(-50%)"
                            : steps[currentIdx].position === "left"
                                ? "translate(-100%, -50%)"
                                : "translate(-50%, -100%)"
                }}
            >
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="badge-brand text-[9px] px-2">Step {currentIdx + 1} of {steps.length}</span>
                        <button onClick={onComplete} className="text-fg-subtle hover:text-fg transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div>
                        <h4 className="font-black text-fg uppercase tracking-tight text-lg">{steps[currentIdx].title}</h4>
                        <p className="text-xs text-fg-muted mt-1.5 leading-relaxed">{steps[currentIdx].description}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                        <button 
                            onClick={onComplete}
                            className="text-[10px] font-black uppercase text-fg-subtle hover:text-fg"
                        >
                            Skip
                        </button>
                        <button 
                            onClick={() => {
                                if (currentIdx < steps.length - 1) {
                                    setCurrentIdx(currentIdx + 1);
                                } else {
                                    onComplete();
                                }
                            }}
                            className="btn-primary btn-sm rounded-xl px-5 h-9"
                        >
                            {currentIdx === steps.length - 1 ? "Finish" : "Next"}
                            <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </button>
                    </div>
                </div>

                {/* Arrow */}
                <div 
                    className={cn(
                        "absolute w-4 h-4 bg-surface-elevated border-brand-500/30 border-l border-t rotate-45",
                        steps[currentIdx].position === "bottom" && "-top-2 left-1/2 -ml-2",
                        steps[currentIdx].position === "top" && "-bottom-2 left-1/2 -ml-2 rotate-[225deg]",
                        steps[currentIdx].position === "right" && "-left-2 top-1/2 -mt-2 -rotate-45",
                        steps[currentIdx].position === "left" && "-right-2 top-1/2 -mt-2 rotate-[135deg]"
                    )}
                />
            </div>
        </div>
    );
}
