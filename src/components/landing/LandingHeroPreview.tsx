"use client";

export function LandingHeroPreview() {
    return (
        <div className="relative w-full animate-slide-up animate-delay-200">
            <div className="card overflow-hidden border-surface-border/60">
                <div className="bg-gradient-to-b from-surface-card to-surface p-6 sm:p-10">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                        {[
                            { label: "PR – Bench", val: "120 kg", delta: "+5kg" },
                            { label: "Workouts", val: "47", delta: "+12" },
                            { label: "Body Weight", val: "82.3 kg", delta: "-2.1kg" },
                            { label: "Streak", val: "14 days", delta: "🔥" },
                        ].map((s) => (
                            <div key={s.label} className="stat-card">
                                <p className="stat-label">{s.label}</p>
                                <p className="stat-value text-lg">{s.val}</p>
                                <p className="stat-delta text-success">{s.delta}</p>
                            </div>
                        ))}
                    </div>

                    <div className="h-32 flex items-end gap-2 px-2">
                        {[40, 55, 48, 70, 65, 80, 75, 90, 85, 95, 88, 100].map((h, i) => (
                            <div
                                key={i}
                                className="flex-1 rounded-t-md opacity-80 transition-all duration-300"
                                style={{
                                    height: `${h}%`,
                                    background: i === 11
                                        ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                                        : `rgba(99,102,241,${0.2 + i * 0.06})`,
                                }}
                            />
                        ))}
                    </div>
                    <p className="text-center text-xs text-fg-subtle mt-2">
                        Strength progression over 12 weeks
                    </p>
                </div>
            </div>
        </div>
    );
}
