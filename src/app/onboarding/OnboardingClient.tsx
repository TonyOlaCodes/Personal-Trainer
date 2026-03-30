"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, ChevronRight, ChevronLeft, SkipForward, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Step 1 data ─────────────────────────────────────────────────────────────
const goals = [
    { id: "GAIN_MUSCLE", label: "Build Muscle", emoji: "💪", desc: "Gain size and strength" },
    { id: "LOSE_WEIGHT", label: "Lose Weight", emoji: "🔥", desc: "Shed body fat" },
    { id: "RECOMPOSITION", label: "Recomp", emoji: "⚡", desc: "Lose fat, gain muscle" },
    { id: "STRENGTH", label: "Strength", emoji: "🏋️", desc: "Increase max lifts" },
];
const experienceLevels = [
    { id: "BEGINNER", label: "Beginner", desc: "< 1 year training" },
    { id: "INTERMEDIATE", label: "Intermediate", desc: "1-3 years training" },
    { id: "ADVANCED", label: "Advanced", desc: "3+ years training" },
];
const trainingDayOptions = [2, 3, 4, 5, 6];

// ── Step 2 data ─────────────────────────────────────────────────────────────
const muscleGroups = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Glutes", "Core"];
const splits = ["PPL", "Upper/Lower", "Bro Split", "Arnold", "Full Body", "Custom"];

interface FormData {
    // Step 1
    goal: string;
    trainingDaysPerWeek: number;
    experienceLevel: string;
    trainingLocation: string;
    hasInjuries: boolean;
    injuryDetails: string;
    // Step 2
    age: string;
    heightCm: string;
    weightKg: string;
    targetWeightKg: string;
    sessionLengthMin: string;
    weakMuscles: string[];
    preferredSplit: string;
    cardioPreference: string;
    dietAwareness: boolean;
    secretCode?: string;
}

const defaultForm: FormData = {
    goal: "",
    trainingDaysPerWeek: 4,
    experienceLevel: "",
    trainingLocation: "GYM",
    hasInjuries: false,
    injuryDetails: "",
    age: "",
    heightCm: "",
    weightKg: "",
    targetWeightKg: "",
    sessionLengthMin: "60",
    weakMuscles: [],
    preferredSplit: "",
    cardioPreference: "",
    dietAwareness: false,
    secretCode: "",
};

const TOTAL_STEPS = 3; // S1 required, S2 optional, S3 confirm

export function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [form, setForm] = useState<FormData>(defaultForm);
    const [saving, setSaving] = useState(false);

    const progress = (step / TOTAL_STEPS) * 100;

    const update = (key: keyof FormData, value: unknown) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const toggleMuscle = (m: string) => {
        setForm((prev) => ({
            ...prev,
            weakMuscles: prev.weakMuscles.includes(m)
                ? prev.weakMuscles.filter((x) => x !== m)
                : [...prev.weakMuscles, m],
        }));
    };

    const handleSubmit = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/user/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                router.push("/dashboard");
            } else {
                const data = await res.json();
                alert(data.error || "Failed to save profile.");
            }
        } catch (e) {
            alert("Connection error.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-brand-600/8 rounded-full blur-3xl pointer-events-none" />

            <div className="relative w-full max-w-xl">
                {/* Logo */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    <div className="w-8 h-8 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-sm">
                        <Zap className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold text-lg">FitCoach Pro</span>
                </div>

                {/* Progress bar */}
                <div className="mb-6">
                    <div className="flex justify-between text-xs text-fg-muted mb-2">
                        <span>Step {step} of {TOTAL_STEPS}</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                </div>

                {/* Card */}
                <div className="card-elevated p-8 animate-slide-up">
                    {/* ── Step 1: Required Info ─────────────────────────── */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="heading-2 mb-1">Tell us about yourself</h2>
                                <p className="subheading">This helps us personalise your experience.</p>
                            </div>

                            {/* Goal */}
                            <div>
                                <label className="label">Your primary goal</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {goals.map((g) => (
                                        <button
                                            key={g.id}
                                            onClick={() => update("goal", g.id)}
                                            className={cn(
                                                "text-left p-4 rounded-xl border transition-all duration-200",
                                                form.goal === g.id
                                                    ? "border-brand-600 bg-brand-950/60 shadow-glow-sm"
                                                    : "border-surface-border bg-surface-muted hover:border-brand-700/50"
                                            )}
                                        >
                                            <span className="text-2xl">{g.emoji}</span>
                                            <p className="font-semibold text-sm mt-2">{g.label}</p>
                                            <p className="text-xs text-fg-muted">{g.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Training days */}
                            <div>
                                <label className="label">Training days per week</label>
                                <div className="flex gap-2">
                                    {trainingDayOptions.map((d) => (
                                        <button
                                            key={d}
                                            onClick={() => update("trainingDaysPerWeek", d)}
                                            className={cn(
                                                "flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all",
                                                form.trainingDaysPerWeek === d
                                                    ? "border-brand-600 bg-brand-950/60 text-brand-300"
                                                    : "border-surface-border bg-surface-muted text-fg-muted hover:border-brand-700/50"
                                            )}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Experience */}
                            <div>
                                <label className="label">Experience level</label>
                                <div className="space-y-2">
                                    {experienceLevels.map((e) => (
                                        <button
                                            key={e.id}
                                            onClick={() => update("experienceLevel", e.id)}
                                            className={cn(
                                                "w-full flex items-center justify-between p-3.5 rounded-xl border text-sm transition-all",
                                                form.experienceLevel === e.id
                                                    ? "border-brand-600 bg-brand-950/60"
                                                    : "border-surface-border bg-surface-muted hover:border-brand-700/50"
                                            )}
                                        >
                                            <div className="text-left">
                                                <p className="font-medium">{e.label}</p>
                                                <p className="text-xs text-fg-muted">{e.desc}</p>
                                            </div>
                                            {form.experienceLevel === e.id && (
                                                <Check className="w-4 h-4 text-brand-400" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Location */}
                            <div>
                                <label className="label">Training location</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {["GYM", "HOME"].map((loc) => (
                                        <button
                                            key={loc}
                                            onClick={() => update("trainingLocation", loc)}
                                            className={cn(
                                                "py-3 rounded-xl border text-sm font-semibold transition-all",
                                                form.trainingLocation === loc
                                                    ? "border-brand-600 bg-brand-950/60 text-brand-300"
                                                    : "border-surface-border bg-surface-muted text-fg-muted hover:border-brand-700/50"
                                            )}
                                        >
                                            {loc === "GYM" ? "🏋️ Gym" : "🏠 Home"}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Injuries */}
                            <div>
                                <label className="label">Any injuries or limitations?</label>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    {[{ v: false, l: "No injuries" }, { v: true, l: "Yes, I have some" }].map((opt) => (
                                        <button
                                            key={String(opt.v)}
                                            onClick={() => update("hasInjuries", opt.v)}
                                            className={cn(
                                                "py-3 rounded-xl border text-sm font-medium transition-all",
                                                form.hasInjuries === opt.v
                                                    ? "border-brand-600 bg-brand-950/60 text-brand-300"
                                                    : "border-surface-border bg-surface-muted text-fg-muted"
                                            )}
                                        >
                                            {opt.l}
                                        </button>
                                    ))}
                                </div>
                                {form.hasInjuries && (
                                    <textarea
                                        className="input resize-none h-20"
                                        placeholder="Describe your injuries or limitations..."
                                        value={form.injuryDetails}
                                        onChange={(e) => update("injuryDetails", e.target.value)}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Step 2: Optional Info ─────────────────────────── */}
                    {step === 2 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="heading-2 mb-1">Optional details</h2>
                                <p className="subheading">Help us fine-tune your programme. You can skip this.</p>
                            </div>

                            {/* Body stats */}
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { key: "age", label: "Age", ph: "e.g. 25", unit: "yrs" },
                                    { key: "heightCm", label: "Height", ph: "e.g. 178", unit: "cm" },
                                    { key: "weightKg", label: "Current Weight", ph: "e.g. 80", unit: "kg" },
                                    { key: "targetWeightKg", label: "Target Weight", ph: "e.g. 90", unit: "kg" },
                                ].map((f) => (
                                    <div key={f.key}>
                                        <label className="label">{f.label}</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                className="input pr-10"
                                                placeholder={f.ph}
                                                value={form[f.key as keyof FormData] as string}
                                                onChange={(e) => update(f.key as keyof FormData, e.target.value)}
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg-subtle">
                                                {f.unit}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Session length */}
                            <div>
                                <label className="label">Preferred session length</label>
                                <div className="flex gap-2">
                                    {["30", "45", "60", "75", "90"].map((min) => (
                                        <button
                                            key={min}
                                            onClick={() => update("sessionLengthMin", min)}
                                            className={cn(
                                                "flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all",
                                                form.sessionLengthMin === min
                                                    ? "border-brand-600 bg-brand-950/60 text-brand-300"
                                                    : "border-surface-border bg-surface-muted text-fg-muted"
                                            )}
                                        >
                                            {min}m
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Weak muscles */}
                            <div>
                                <label className="label">Weak muscle groups (optional)</label>
                                <div className="flex flex-wrap gap-2">
                                    {muscleGroups.map((m) => (
                                        <button
                                            key={m}
                                            onClick={() => toggleMuscle(m)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                                                form.weakMuscles.includes(m)
                                                    ? "border-brand-600 bg-brand-950/60 text-brand-300"
                                                    : "border-surface-border bg-surface-muted text-fg-muted"
                                            )}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Preferred split */}
                            <div>
                                <label className="label">Preferred split</label>
                                <div className="flex flex-wrap gap-2">
                                    {splits.map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => update("preferredSplit", s)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                                                form.preferredSplit === s
                                                    ? "border-brand-600 bg-brand-950/60 text-brand-300"
                                                    : "border-surface-border bg-surface-muted text-fg-muted"
                                            )}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Promo Code */}
                            <div className="pt-4 border-t border-surface-border/50">
                                <label className="label flex items-center gap-2">
                                    <Zap className="w-3 h-3 text-brand-400" />
                                    Access Code (Optional)
                                </label>
                                <input
                                    type="text"
                                    className="input font-mono uppercase tracking-wider"
                                    placeholder="Enter access code..."
                                    value={form.secretCode}
                                    onChange={(e) => update("secretCode", e.target.value)}
                                />
                                <p className="text-[10px] text-fg-subtle mt-1.5">
                                    Have a trainer code or promotion? Enter it here to unlock premium features.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Confirm ───────────────────────────────── */}
                    {step === 3 && (
                        <div className="space-y-6 text-center">
                            <div className="w-16 h-16 bg-gradient-brand rounded-2xl flex items-center justify-center mx-auto shadow-glow-brand animate-pulse-brand">
                                <Check className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h2 className="heading-2 mb-2">You&apos;re all set!</h2>
                                <p className="subheading">
                                    Your profile is ready. Let&apos;s take you to your dashboard and get you training.
                                </p>
                            </div>
                            <div className="text-left card p-4 space-y-2">
                                <p className="text-sm"><span className="text-fg-muted">Goal:</span> <span className="font-medium">{form.goal.replace("_", " ")}</span></p>
                                <p className="text-sm"><span className="text-fg-muted">Training days:</span> <span className="font-medium">{form.trainingDaysPerWeek}x/week</span></p>
                                <p className="text-sm"><span className="text-fg-muted">Experience:</span> <span className="font-medium">{form.experienceLevel}</span></p>
                                <p className="text-sm"><span className="text-fg-muted">Location:</span> <span className="font-medium">{form.trainingLocation}</span></p>
                            </div>
                        </div>
                    )}

                    {/* Navigation buttons */}
                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-surface-border">
                        <button
                            onClick={() => setStep((s) => s - 1)}
                            disabled={step === 1}
                            className="btn-ghost disabled:opacity-0"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Back
                        </button>

                        <div className="flex gap-2">
                            {step === 2 && (
                                <button
                                    onClick={() => setStep(3)}
                                    className="btn-ghost text-fg-muted"
                                >
                                    <SkipForward className="w-4 h-4" />
                                    Skip
                                </button>
                            )}

                            {step < 3 ? (
                                <button
                                    onClick={() => setStep((s) => s + 1)}
                                    disabled={step === 1 && (!form.goal || !form.experienceLevel)}
                                    className="btn-primary"
                                >
                                    Continue
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    onClick={handleSubmit}
                                    disabled={saving}
                                    className="btn-primary"
                                >
                                    {saving ? "Saving..." : "Go to Dashboard"}
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
