"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, ChevronRight, ChevronLeft, Check, Loader2, User } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/shared/BrandLogo";
import {
    type UnitSystem,
    cmToFeetInches,
    feetInchesToCm,
    formatHeightFromCm,
    formatWeightFromKg,
    kgToLbsNumber,
    lbsToKg,
    metricBodyFromForm,
    parseOptionalFloat,
} from "@/lib/units";
import { useClerk, useUser } from "@clerk/nextjs";
import { defaultHomeForRole } from "@/lib/roles";
import { httpErrorMessage } from "@/lib/httpErrorMessage";
import {
    EXPERIENCE_SLIDER_LABELS,
    ONBOARDING_GOAL_OPTIONS,
    USERNAME_MAX_LENGTH,
    WORKOUT_DURATION_OPTIONS,
    experienceFromSlider,
    getAgeFromDateOfBirth,
    getDefaultDateOfBirthInputValue,
    isEligibleDateOfBirth,
} from "@/lib/onboardingProfile";

const GENDER_CHOICES = [
    { id: "MALE", symbol: "♂" },
    { id: "FEMALE", symbol: "♀" },
    { id: "PREFER_NOT_TO_SAY", symbol: "🤐" },
] as const;
const DEFAULT_EXPERIENCE_SLIDER = 1;

interface FormData {
    firstName: string;
    lastName: string;
    username: string;
    gender: string;
    dateOfBirth: string;
    secretCode: string;
    goal: string;
    trainingDaysPerWeek: number;
    experienceLevel: string;
    experienceSlider: number;
    trainingLocation: string;
    sessionLengthMin: number | null;
    hasInjuries: boolean;
    injuryDetails: string;
    unitSystem: UnitSystem;
    heightCm: string;
    heightFt: string;
    heightIn: string;
    weightKg: string;
    weightLbs: string;
    targetWeightKg: string;
    targetWeightLbs: string;
    targetCalories: string;
    targetSteps: string;
    targetSleepHours: string;
}

const TOTAL_STEPS = 3;

const GOAL_LABELS: Record<string, string> = {
    GAIN_MUSCLE: "Build Muscle",
    LOSE_WEIGHT: "Lose Fat",
    RECOMPOSITION: "Body Recomposition",
    STRENGTH: "Get Stronger",
};

const EXPERIENCE_LABELS: Record<string, string> = {
    BEGINNER: "Beginner",
    INTERMEDIATE: "Intermediate",
    ADVANCED: "Advanced",
};

export function OnboardingPage() {
    const router = useRouter();
    const { signOut } = useClerk();
    const { user: clerkUser, isLoaded } = useUser();
    const [step, setStep] = useState(1);
    const [showSummary, setShowSummary] = useState(false);
    const [form, setForm] = useState<FormData>({
        firstName: "",
        lastName: "",
        username: "",
        gender: "",
        dateOfBirth: getDefaultDateOfBirthInputValue(),
        secretCode: "",
        goal: "",
        trainingDaysPerWeek: 5,
        experienceLevel: experienceFromSlider(DEFAULT_EXPERIENCE_SLIDER),
        experienceSlider: DEFAULT_EXPERIENCE_SLIDER,
        trainingLocation: "GYM",
        sessionLengthMin: null,
        hasInjuries: false,
        injuryDetails: "",
        unitSystem: "METRIC",
        heightCm: "",
        heightFt: "",
        heightIn: "",
        weightKg: "",
        weightLbs: "",
        targetWeightKg: "",
        targetWeightLbs: "",
        targetCalories: "",
        targetSteps: "",
        targetSleepHours: "",
    });
    const [saving, setSaving] = useState(false);
    const [exiting, setExiting] = useState(false);
    const [codeStatus, setCodeStatus] = useState<"idle" | "checking" | "valid" | "error">("idle");
    const [codeMessage, setCodeMessage] = useState("");
    const [coachName, setCoachName] = useState("");
    const [membershipLabel, setMembershipLabel] = useState("");
    const [coachCodeRequested, setCoachCodeRequested] = useState(false);
    const [requestCodeMessage, setRequestCodeMessage] = useState("");
    const [dobContinueAttempted, setDobContinueAttempted] = useState(false);
    const [prefilled, setPrefilled] = useState(false);

    useEffect(() => {
        if (!isLoaded || !clerkUser || prefilled) return;
        setForm((prev) => ({
            ...prev,
            firstName: clerkUser.firstName?.trim() || prev.firstName,
            lastName: clerkUser.lastName?.trim() || prev.lastName,
        }));
        setPrefilled(true);
    }, [clerkUser, isLoaded, prefilled]);

    const progress = ((step - 1 + (showSummary ? 1 : 0)) / TOTAL_STEPS) * 100;

    const update = (key: keyof FormData, value: unknown) => {
        if (key === "secretCode") {
            setCodeStatus("idle");
            setCodeMessage("");
            setCoachName("");
            setMembershipLabel("");
        }
        if (key === "experienceSlider") {
            const sliderValue = Number(value);
            setForm((prev) => ({
                ...prev,
                experienceSlider: sliderValue,
                experienceLevel: experienceFromSlider(sliderValue),
            }));
            return;
        }
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const setUnitSystem = (next: UnitSystem) => {
        if (next === form.unitSystem) return;

        setForm((prev) => {
            if (next === "IMPERIAL") {
                const height = parseOptionalFloat(prev.heightCm);
                const weight = parseOptionalFloat(prev.weightKg);
                const targetWeight = parseOptionalFloat(prev.targetWeightKg);
                const { feet, inches } = height != null ? cmToFeetInches(height) : { feet: 0, inches: 0 };

                return {
                    ...prev,
                    unitSystem: "IMPERIAL",
                    heightFt: height != null ? String(feet) : "",
                    heightIn: height != null ? String(inches) : "",
                    weightLbs: weight != null ? kgToLbsNumber(weight).toFixed(1) : "",
                    targetWeightLbs: targetWeight != null ? kgToLbsNumber(targetWeight).toFixed(1) : "",
                };
            }

            const feet = parseOptionalFloat(prev.heightFt) ?? 0;
            const inches = parseOptionalFloat(prev.heightIn) ?? 0;
            const hasHeight = Boolean(prev.heightFt.trim() || prev.heightIn.trim());
            const weight = parseOptionalFloat(prev.weightLbs);
            const targetWeight = parseOptionalFloat(prev.targetWeightLbs);

            return {
                ...prev,
                unitSystem: "METRIC",
                heightCm: hasHeight ? String(Math.round(feetInchesToCm(feet, inches))) : prev.heightCm,
                weightKg: weight != null ? lbsToKg(weight).toFixed(2) : prev.weightKg,
                targetWeightKg: targetWeight != null ? lbsToKg(targetWeight).toFixed(2) : prev.targetWeightKg,
            };
        });
    };

    const handleExitSetup = async () => {
        setExiting(true);
        await signOut({ redirectUrl: "/?view=landing" });
    };

    const handleRequestCoachCode = () => {
        if (coachCodeRequested) return;
        setCoachCodeRequested(true);
        setRequestCodeMessage("Request sent. An admin or coach will reach out shortly.");
    };

    const validateAccessCode = async () => {
        const code = form.secretCode?.trim();
        if (!code) return true;

        setCodeStatus("checking");
        setCodeMessage("");
        try {
            const res = await fetch("/api/codes/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setCodeStatus("error");
                setCodeMessage(httpErrorMessage(res.status, data, "Invalid code"));
                return false;
            }

            setCodeStatus("valid");
            setMembershipLabel(data.membershipLabel || "");
            setCoachName(data.coachName || "");
            setCodeMessage(
                data.upgradesTo === "GENERAL_PREMIUM"
                    ? "Premium access confirmed."
                    : data.coachName
                        ? "Coach invite confirmed."
                        : "Code looks good."
            );
            return true;
        } catch {
            setCodeStatus("error");
            setCodeMessage("Could not check code. Try again.");
            return false;
        }
    };

    const handleContinue = async () => {
        if (step === 1) {
            if (!isEligibleDateOfBirth(form.dateOfBirth)) {
                setDobContinueAttempted(true);
                return;
            }
            const code = form.secretCode?.trim();
            if (code) {
                const valid = await validateAccessCode();
                if (!valid) return;
            }
            setStep(2);
            return;
        }

        if (step === 2) {
            setStep(3);
            return;
        }

        if (step === 3 && !showSummary) {
            setShowSummary(true);
        }
    };

    const handleSubmit = async () => {
        setSaving(true);
        try {
            const bodyMetrics = metricBodyFromForm(form);
            const payload = {
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim() || undefined,
                username: form.username.trim() || undefined,
                gender: form.gender,
                dateOfBirth: form.dateOfBirth,
                goal: form.goal,
                trainingDaysPerWeek: form.trainingDaysPerWeek,
                experienceLevel: form.experienceLevel || experienceFromSlider(form.experienceSlider),
                trainingLocation: form.trainingLocation,
                sessionLengthMin: form.sessionLengthMin,
                hasInjuries: form.hasInjuries,
                injuryDetails: form.injuryDetails,
                unitSystem: form.unitSystem,
                heightCm: bodyMetrics.heightCm != null ? String(bodyMetrics.heightCm) : "",
                weightKg: bodyMetrics.weightKg != null ? String(bodyMetrics.weightKg) : "",
                targetWeightKg: bodyMetrics.targetWeightKg != null ? String(bodyMetrics.targetWeightKg) : "",
                targetCalories: form.targetCalories,
                targetSteps: form.targetSteps,
                targetSleepHours: form.targetSleepHours,
                secretCode: form.secretCode?.trim() || undefined,
                coachCodeRequested,
            };

            const res = await fetch("/api/user/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                const data = await res.json();
                router.push(data.redirectTo ?? defaultHomeForRole(data.role ?? "FREE"));
            } else {
                const data = await res.json().catch(() => ({ error: "Failed to save profile." }));
                alert(data.error || "Failed to save profile.");
            }
        } catch {
            alert("Connection error.");
        } finally {
            setSaving(false);
        }
    };

    const stepTitle =
        step === 1 ? "Your Profile" : step === 2 ? "Training" : showSummary ? "You're ready to train!" : "Optional Details";

    const coachStatusLabel = codeStatus === "valid"
        ? membershipLabel === "Premium"
            ? "Premium Connected ✓"
            : coachName
                ? "Coach Connected ✓"
                : "Access Code Applied ✓"
        : coachCodeRequested
            ? "Coach Code Requested"
            : "Using Free Plan";

    const canContinueStep1 = Boolean(
        form.firstName.trim() &&
        form.gender &&
        form.dateOfBirth &&
        form.username.length <= USERNAME_MAX_LENGTH
    );
    const dobEligible = isEligibleDateOfBirth(form.dateOfBirth);
    const dobAge = getAgeFromDateOfBirth(form.dateOfBirth);
    const showDobError = dobContinueAttempted && !dobEligible;
    const canContinueStep2 = Boolean(form.goal);
    const experienceMeta = EXPERIENCE_SLIDER_LABELS[form.experienceSlider] ?? EXPERIENCE_SLIDER_LABELS[1];

    return (
        <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-surface flex flex-col items-center justify-center px-4 py-6 sm:p-6">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[400px] overflow-hidden">
                <div className="absolute left-1/2 top-0 h-full w-[min(100%,42rem)] -translate-x-1/2 bg-brand-600/8 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full min-w-0 max-w-xl">
                <div className="flex items-center justify-center gap-2 mb-8">
                    <div className="w-8 h-8 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-sm">
                        <Zap className="w-4 h-4 text-white" />
                    </div>
                    <BrandLogo className="text-lg" />
                </div>

                <div className="mb-6">
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-fg-muted mb-2">
                        <span className="shrink-0">Step {step} of {TOTAL_STEPS}</span>
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={handleExitSetup}
                                disabled={exiting}
                                className="font-semibold text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-60"
                            >
                                {exiting ? "Exiting..." : "Exit setup"}
                            </button>
                            <span>{Math.round(progress)}%</span>
                        </div>
                    </div>
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                </div>

                <div className="card-elevated min-w-0 overflow-hidden p-5 sm:p-8 animate-slide-up">
                    <div className="mb-6">
                        <h2 className="heading-2 mb-1">{stepTitle}</h2>
                        {step === 1 && <p className="subheading">Tell us who you are so we can personalize your account.</p>}
                        {step === 2 && <p className="subheading">Help us understand how you like to train.</p>}
                        {step === 3 && !showSummary && <p className="subheading">Optional body details to fine-tune your experience.</p>}
                        {step === 3 && showSummary && (
                            <p className="subheading">
                                Your profile is ready. Head to your dashboard to start training — you can redeem a coach code anytime in Settings.
                            </p>
                        )}
                    </div>

                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-muted border border-surface-border">
                                {clerkUser?.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={clerkUser.imageUrl}
                                        alt=""
                                        width={56}
                                        height={56}
                                        className="w-14 h-14 rounded-full object-cover shrink-0"
                                        referrerPolicy="no-referrer"
                                    />
                                ) : (
                                    <div className="w-14 h-14 rounded-full bg-brand-950/60 border border-brand-700/40 flex items-center justify-center">
                                        <User className="w-6 h-6 text-brand-300" />
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold truncate">
                                        {[form.firstName, form.lastName].filter(Boolean).join(" ") || "Your profile"}
                                    </p>
                                    <p className="text-xs text-fg-muted truncate">{clerkUser?.primaryEmailAddress?.emailAddress}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">First name *</label>
                                    <input
                                        className="input"
                                        value={form.firstName}
                                        onChange={(e) => update("firstName", e.target.value)}
                                        placeholder="First name"
                                    />
                                </div>
                                <div>
                                    <label className="label">Last name</label>
                                    <input
                                        className="input"
                                        value={form.lastName}
                                        onChange={(e) => update("lastName", e.target.value)}
                                        placeholder="Optional"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label">Username</label>
                                <input
                                    className="input font-mono"
                                    value={form.username}
                                    maxLength={USERNAME_MAX_LENGTH + 1}
                                    onChange={(e) => update("username", e.target.value.toLowerCase())}
                                />
                                {form.username.length > USERNAME_MAX_LENGTH && (
                                    <p className="text-[10px] text-danger mt-1.5 font-semibold">
                                        Maximum {USERNAME_MAX_LENGTH} characters.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="label">Gender *</label>
                                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 min-w-0">
                                    {GENDER_CHOICES.map((option) => {
                                        const selected = form.gender === option.id;
                                        const isMale = option.id === "MALE";
                                        const isFemale = option.id === "FEMALE";

                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => update("gender", option.id)}
                                                className={cn(
                                                    "min-w-0 py-3 px-1 rounded-xl border text-sm font-medium transition-all",
                                                    selected && isMale && "border-sky-500 bg-sky-500/10 text-sky-400",
                                                    selected && isFemale && "border-pink-500 bg-pink-500/10 text-pink-400",
                                                    selected && option.id === "PREFER_NOT_TO_SAY" && "border-brand-600 bg-brand-950/60 text-brand-300",
                                                    !selected && "border-surface-border bg-surface-muted text-fg-muted hover:border-brand-700/50"
                                                )}
                                            >
                                                <span className="text-xl leading-none">{option.symbol}</span>
                                                {(isMale || isFemale) && (
                                                    <span className="mt-1 block text-[10px] font-black uppercase tracking-wide">
                                                        {isMale ? "Male" : "Female"}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="label">Date of birth *</label>
                                <input
                                    type="date"
                                    className={cn("input", showDobError && "border-danger focus:border-danger focus:ring-danger/40")}
                                    value={form.dateOfBirth}
                                    onChange={(e) => {
                                        update("dateOfBirth", e.target.value);
                                        if (isEligibleDateOfBirth(e.target.value)) setDobContinueAttempted(false);
                                    }}
                                />
                                {dobAge !== null && (
                                    <p className="text-[10px] text-fg-subtle mt-1.5 font-semibold">
                                        You are {dobAge}
                                    </p>
                                )}
                                {showDobError && (
                                    <p className="text-[10px] text-danger mt-1.5 font-semibold">
                                        Must be at least 13.
                                    </p>
                                )}
                            </div>

                            <div className="pt-4 border-t border-surface-border/50 space-y-3">
                                <label className="label">Coach access code (Optional)</label>
                                <input
                                    type="text"
                                    className={cn(
                                        "input font-mono uppercase tracking-wider",
                                        codeStatus === "error" && "border-danger focus:border-danger focus:ring-danger/40",
                                        codeStatus === "valid" && "border-success focus:border-success focus:ring-success/40"
                                    )}
                                    value={form.secretCode}
                                    onChange={(e) => update("secretCode", e.target.value)}
                                />
                                {codeMessage ? (
                                    <p className={cn("text-[10px] font-semibold", codeStatus === "error" ? "text-danger" : "text-success")}>
                                        {codeMessage}
                                    </p>
                                ) : null}
                                <div className="flex flex-wrap items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={handleRequestCoachCode}
                                        disabled={coachCodeRequested}
                                        className="text-xs font-semibold text-brand-400 hover:text-brand-300 disabled:opacity-60"
                                    >
                                        {coachCodeRequested ? "Request sent" : "Don't have a code? Request one"}
                                    </button>
                                    {requestCodeMessage && (
                                        <p className="text-[10px] text-success font-semibold">{requestCodeMessage}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <div>
                                <label className="label">Your primary goal</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {ONBOARDING_GOAL_OPTIONS.map((g) => (
                                        <button
                                            key={g.id}
                                            type="button"
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

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="label mb-0">Training days per week</label>
                                    <span className="text-sm font-bold text-brand-300">{form.trainingDaysPerWeek} days per week</span>
                                </div>
                                <input
                                    type="range"
                                    min={2}
                                    max={6}
                                    step={1}
                                    value={form.trainingDaysPerWeek}
                                    onChange={(e) => update("trainingDaysPerWeek", Number(e.target.value))}
                                    className="w-full accent-brand-500 h-2"
                                />
                                <div className="flex justify-between text-[10px] text-fg-subtle px-0.5 mt-1">
                                    {[2, 3, 4, 5, 6].map((d) => <span key={d}>{d}</span>)}
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="label mb-0">Experience level</label>
                                    <span className="text-sm font-bold text-brand-300">{experienceMeta.label}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={2}
                                    step={1}
                                    value={form.experienceSlider}
                                    onChange={(e) => update("experienceSlider", Number(e.target.value))}
                                    className="w-full accent-brand-500 h-2"
                                />
                                <p className="text-xs text-fg-muted mt-2">{experienceMeta.desc}</p>
                            </div>

                            <div>
                                <label className="label">Typical workout duration</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {WORKOUT_DURATION_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => update("sessionLengthMin", option.value)}
                                            className={cn(
                                                "py-2.5 rounded-xl border text-sm font-semibold transition-all",
                                                form.sessionLengthMin === option.value
                                                    ? "border-brand-600 bg-brand-950/60 text-brand-300"
                                                    : "border-surface-border bg-surface-muted text-fg-muted hover:border-brand-700/50"
                                            )}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => update("sessionLengthMin", null)}
                                    className="mt-2 text-xs text-fg-muted hover:text-brand-300"
                                >
                                    Skip duration
                                </button>
                            </div>

                            <div>
                                <label className="label">Training location</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {["GYM", "HOME"].map((loc) => (
                                        <button
                                            key={loc}
                                            type="button"
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

                            <div>
                                <label className="label">Any injuries or limitations?</label>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    {[{ v: false, l: "None" }, { v: true, l: "Yes" }].map((opt) => (
                                        <button
                                            key={String(opt.v)}
                                            type="button"
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

                    {step === 3 && !showSummary && (
                        <div className="space-y-6">
                            <div>
                                <label className="label">Units</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {([
                                        { id: "METRIC" as const, label: "Metric", desc: "kg, cm" },
                                        { id: "IMPERIAL" as const, label: "Imperial", desc: "lbs, ft & in" },
                                    ]).map((option) => (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => setUnitSystem(option.id)}
                                            className={cn(
                                                "text-left p-3.5 rounded-xl border transition-all duration-200",
                                                form.unitSystem === option.id
                                                    ? "border-brand-600 bg-brand-950/60 shadow-glow-sm"
                                                    : "border-surface-border bg-surface-muted hover:border-brand-700/50"
                                            )}
                                        >
                                            <p className="font-semibold text-sm">{option.label}</p>
                                            <p className="text-xs text-fg-muted">{option.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {form.unitSystem === "METRIC" ? (
                                    <>
                                        {[
                                            { key: "heightCm" as const, label: "Height", ph: "e.g. 178", unit: "cm" },
                                            { key: "weightKg" as const, label: "Current weight", ph: "e.g. 80", unit: "kg" },
                                            { key: "targetWeightKg" as const, label: "Target weight", ph: "Optional", unit: "kg" },
                                        ].map((f) => (
                                            <div key={f.key} className={f.key === "heightCm" ? "" : ""}>
                                                <label className="label">{f.label}</label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        className="input pr-10"
                                                        placeholder={f.ph}
                                                        value={form[f.key]}
                                                        onChange={(e) => update(f.key, e.target.value)}
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg-subtle">
                                                        {f.unit}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <label className="label">Height</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className="input pr-8"
                                                        placeholder="5"
                                                        value={form.heightFt}
                                                        onChange={(e) => update("heightFt", e.target.value)}
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-fg-subtle">ft</span>
                                                </div>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="11"
                                                        className="input pr-8"
                                                        placeholder="10"
                                                        value={form.heightIn}
                                                        onChange={(e) => update("heightIn", e.target.value)}
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-fg-subtle">in</span>
                                                </div>
                                            </div>
                                        </div>
                                        {[
                                            { key: "weightLbs" as const, label: "Current weight", ph: "e.g. 175", unit: "lbs" },
                                            { key: "targetWeightLbs" as const, label: "Target weight", ph: "Optional", unit: "lbs" },
                                        ].map((f) => (
                                            <div key={f.key}>
                                                <label className="label">{f.label}</label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        className="input pr-10"
                                                        placeholder={f.ph}
                                                        value={form[f.key]}
                                                        onChange={(e) => update(f.key, e.target.value)}
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg-subtle">
                                                        {f.unit}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>

                            <div className="pt-4 border-t border-surface-border/50">
                                <label className="label">Daily targets (optional)</label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {[
                                        { key: "targetCalories", label: "Calories", ph: "e.g. 2500", unit: "kcal", step: "1" },
                                        { key: "targetSteps", label: "Steps", ph: "e.g. 10000", unit: "steps", step: "1" },
                                        { key: "targetSleepHours", label: "Sleep", ph: "e.g. 8", unit: "hrs", step: "0.1" },
                                    ].map((f) => (
                                        <div key={f.key}>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-fg-subtle mb-1 block">{f.label}</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step={f.step}
                                                    className="input pr-14"
                                                    placeholder={f.ph}
                                                    value={form[f.key as keyof FormData] as string}
                                                    onChange={(e) => update(f.key as keyof FormData, e.target.value)}
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-fg-subtle">
                                                    {f.unit}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && showSummary && (
                        <div className="space-y-6">
                            <div className="w-16 h-16 bg-gradient-brand rounded-2xl flex items-center justify-center mx-auto shadow-glow-brand animate-pulse-brand">
                                <Check className="w-8 h-8 text-white" />
                            </div>

                            <div className="text-left card p-4 space-y-2">
                                <p className="text-sm">
                                    <span className="text-fg-muted">Name:</span>{" "}
                                    <span className="font-medium">{[form.firstName, form.lastName].filter(Boolean).join(" ")}</span>
                                </p>
                                <p className="text-sm">
                                    <span className="text-fg-muted">Goal:</span>{" "}
                                    <span className="font-medium">{GOAL_LABELS[form.goal] ?? form.goal}</span>
                                </p>
                                <p className="text-sm">
                                    <span className="text-fg-muted">Training days:</span>{" "}
                                    <span className="font-medium">{form.trainingDaysPerWeek}x/week</span>
                                </p>
                                <p className="text-sm">
                                    <span className="text-fg-muted">Experience:</span>{" "}
                                    <span className="font-medium">{EXPERIENCE_LABELS[form.experienceLevel] ?? form.experienceLevel}</span>
                                </p>
                                <p className="text-sm">
                                    <span className="text-fg-muted">Location:</span>{" "}
                                    <span className="font-medium">{form.trainingLocation === "GYM" ? "Gym" : "Home"}</span>
                                </p>
                                {form.sessionLengthMin && (
                                    <p className="text-sm">
                                        <span className="text-fg-muted">Workout duration:</span>{" "}
                                        <span className="font-medium">
                                            {form.sessionLengthMin >= 90 ? "90+ min" : `${form.sessionLengthMin} min`}
                                        </span>
                                    </p>
                                )}
                                <p className="text-sm pt-2 border-t border-surface-border/50">
                                    <span className="text-fg-muted">Coach status:</span>{" "}
                                    <span className={cn(
                                        "font-semibold",
                                        coachStatusLabel.includes("✓") ? "text-success" : coachCodeRequested ? "text-brand-300" : "text-fg-muted"
                                    )}>
                                        {coachStatusLabel}
                                    </span>
                                </p>
                                {(() => {
                                    const body = metricBodyFromForm(form);
                                    if (!body.heightCm && !body.weightKg && !body.targetWeightKg) return null;
                                    return (
                                        <>
                                            {body.heightCm != null && (
                                                <p className="text-sm">
                                                    <span className="text-fg-muted">Height:</span>{" "}
                                                    <span className="font-medium">{formatHeightFromCm(body.heightCm, form.unitSystem)}</span>
                                                </p>
                                            )}
                                            {body.weightKg != null && (
                                                <p className="text-sm">
                                                    <span className="text-fg-muted">Current weight:</span>{" "}
                                                    <span className="font-medium">{formatWeightFromKg(body.weightKg, form.unitSystem)}</span>
                                                </p>
                                            )}
                                            {body.targetWeightKg != null && (
                                                <p className="text-sm">
                                                    <span className="text-fg-muted">Target weight:</span>{" "}
                                                    <span className="font-medium">{formatWeightFromKg(body.targetWeightKg, form.unitSystem)}</span>
                                                </p>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 mt-8 pt-6 border-t border-surface-border">
                        <button
                            type="button"
                            onClick={() => {
                                if (step === 3 && showSummary) {
                                    setShowSummary(false);
                                    return;
                                }
                                setStep((s) => Math.max(1, s - 1));
                            }}
                            disabled={step === 1}
                            className="btn-ghost disabled:opacity-0 shrink-0"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Back
                        </button>

                        <div className="flex gap-2 shrink-0 ml-auto">
                            {step === 3 && showSummary ? (
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={saving}
                                    className="btn-primary"
                                >
                                    {saving ? "Saving..." : "Go to Dashboard"}
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleContinue}
                                    disabled={
                                        (step === 1 && !canContinueStep1) ||
                                        (step === 2 && !canContinueStep2) ||
                                        codeStatus === "checking"
                                    }
                                    className="btn-primary"
                                >
                                    {codeStatus === "checking" ? "Checking..." : "Continue"}
                                    {codeStatus === "checking" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                            )}
                        </div>
                    </div>

                    <p className="mt-6 text-center text-[11px] text-fg-subtle leading-relaxed break-words">
                        By continuing, you agree to our{" "}
                        <Link href="/terms" className="text-brand-400 hover:text-brand-300 font-semibold">
                            Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link href="/privacy" className="text-brand-400 hover:text-brand-300 font-semibold">
                            Privacy Policy
                        </Link>
                        .
                    </p>
                </div>
            </div>
        </div>
    );
}
