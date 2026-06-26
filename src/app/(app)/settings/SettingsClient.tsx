"use client";

import { useState, useRef, useEffect } from "react";
import {
    User, Bell, Palette,
    HelpCircle, LogOut, ChevronRight, Check,
    Camera, Loader2, Save, Target, RotateCcw
} from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn, getInitials } from "@/lib/utils";
import { resolveUploadUrl, uploadMediaFile } from "@/lib/compressImage";
import { isCoachRole, isClientRole } from "@/lib/roles";
import { DEFAULT_MISSED_NOTIFY_TIME } from "@/lib/coachNotificationSchedule";

interface Props {
    user: {
        name?: string | null;
        email: string;
        role: string;
        onboardingDone: boolean;
        avatarUrl?: string | null;
        goal?: string | null;
        trainingDaysPerWeek?: number | null;
        experienceLevel?: string | null;
        trainingLocation?: string | null;
        targetWeightKg?: number | null;
        weightKg?: number | null;
        targetCalories?: number | null;
        targetSteps?: number | null;
        targetSleepHours?: number | null;
        hiddenGoals: string[];
        notifyOnWorkout?: boolean;
        notifyOnCheckIn?: boolean;
        notifyOnMetricUpdate?: boolean;
        notifyOnCoachMessage?: boolean;
        notifyOnPlanUpdate?: boolean;
        notifyOnCheckInReview?: boolean;
        notifyOnWorkoutFeedback?: boolean;
        notifyOnMissedCheckIn?: boolean;
        notifyOnMissedWorkout?: boolean;
        notifyOnWorkoutTime?: string | null;
        notifyOnCheckInTime?: string | null;
        notifyOnMetricUpdateTime?: string | null;
        notifyOnMissedCheckInTime?: string | null;
        notifyOnMissedWorkoutTime?: string | null;
    };
}

const GOAL_LABELS: Record<string, string> = {
    GAIN_MUSCLE: "Build Muscle",
    LOSE_WEIGHT: "Lose Weight",
    RECOMPOSITION: "Body Recomposition",
    STRENGTH: "Gain Strength",
};
const EXP_LABELS: Record<string, string> = {
    BEGINNER: "Beginner",
    INTERMEDIATE: "Intermediate",
    ADVANCED: "Advanced",
};
const LOC_LABELS: Record<string, string> = {
    GYM: "Gym",
    HOME: "Home / Home Gym",
};

export function SettingsClient({ user }: Props) {
    const { signOut } = useClerk();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("profile");

    // Profile form states
    const [name, setName] = useState(user.name || "");
    const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // Goals form states
    const [goal, setGoal] = useState(user.goal || "");
    const [trainingDays, setTrainingDays] = useState(user.trainingDaysPerWeek ?? 3);
    const [experience, setExperience] = useState(user.experienceLevel || "");
    const [location, setLocation] = useState(user.trainingLocation || "");
    const [targetWeight, setTargetWeight] = useState(user.targetWeightKg ? user.targetWeightKg.toFixed(2) : "");
    const [currentWeight, setCurrentWeight] = useState(user.weightKg ? user.weightKg.toFixed(2) : "");
    const [targetCalories, setTargetCalories] = useState(user.targetCalories ? String(user.targetCalories) : "");
    const [targetSteps, setTargetSteps] = useState(user.targetSteps ? String(user.targetSteps) : "");
    const [targetSleepHours, setTargetSleepHours] = useState(user.targetSleepHours ? user.targetSleepHours.toString() : "");
    const [hiddenGoals, setHiddenGoals] = useState<string[]>(user.hiddenGoals || []);
    const [goalSaving, setGoalSaving] = useState(false);
    const [goalSaved, setGoalSaved] = useState(false);

    const showCoachNotifications = isCoachRole(user.role);
    const showClientNotifications = isClientRole(user.role);

    const sections = [
        { id: "profile", label: "Profile", icon: User },
        ...(isClientRole(user.role) ? [{ id: "goals", label: "My Goals", icon: Target }] : []),
        { id: "appearance", label: "Appearance", icon: Palette },
        { id: "notifications", label: "Notifications", icon: Bell },
    ];

    const [notifyOnWorkout, setNotifyOnWorkout] = useState(user.notifyOnWorkout ?? true);
    const [notifyOnCheckIn, setNotifyOnCheckIn] = useState(user.notifyOnCheckIn ?? true);
    const [notifyOnMetricUpdate, setNotifyOnMetricUpdate] = useState(user.notifyOnMetricUpdate ?? true);
    const [notifyOnCoachMessage, setNotifyOnCoachMessage] = useState(user.notifyOnCoachMessage ?? true);
    const [notifyOnPlanUpdate, setNotifyOnPlanUpdate] = useState(user.notifyOnPlanUpdate ?? true);
    const [notifyOnCheckInReview, setNotifyOnCheckInReview] = useState(user.notifyOnCheckInReview ?? true);
    const [notifyOnWorkoutFeedback, setNotifyOnWorkoutFeedback] = useState(user.notifyOnWorkoutFeedback ?? true);
    const [notifyOnMissedCheckIn, setNotifyOnMissedCheckIn] = useState(user.notifyOnMissedCheckIn ?? true);
    const [notifyOnMissedWorkout, setNotifyOnMissedWorkout] = useState(user.notifyOnMissedWorkout ?? true);
    const [notifyOnWorkoutTime, setNotifyOnWorkoutTime] = useState(user.notifyOnWorkoutTime ?? "");
    const [notifyOnCheckInTime, setNotifyOnCheckInTime] = useState(user.notifyOnCheckInTime ?? "");
    const [notifyOnMetricUpdateTime, setNotifyOnMetricUpdateTime] = useState(user.notifyOnMetricUpdateTime ?? "");
    const [notifyOnMissedCheckInTime, setNotifyOnMissedCheckInTime] = useState(
        user.notifyOnMissedCheckInTime ?? DEFAULT_MISSED_NOTIFY_TIME
    );
    const [notifyOnMissedWorkoutTime, setNotifyOnMissedWorkoutTime] = useState(
        user.notifyOnMissedWorkoutTime ?? DEFAULT_MISSED_NOTIFY_TIME
    );
    const [notifSaving, setNotifSaving] = useState(false);
    const [notifSaved, setNotifSaved] = useState(false);

    // Access code state
    const [secretCode, setSecretCode] = useState("");
    const [redeeming, setRedeeming] = useState(false);

    const [theme, setTheme] = useState(typeof window !== "undefined" ? localStorage.getItem("pt-theme") || "midnight" : "midnight");

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("pt-theme", theme);
    }, [theme]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || uploading) return;
        setUploading(true);
        try {
            const url = await uploadMediaFile(file);
            setAvatarUrl(url);
        } catch (error) {
            alert(error instanceof Error ? error.message : "Upload failed");
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const handleRemoveAvatar = () => {
        setAvatarUrl("");
        if (fileRef.current) fileRef.current.value = "";
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, avatarUrl: avatarUrl || "" })
            });
            if (res.ok) {
                alert("Profile Updated Successfully!");
                window.location.reload();
            } else {
                const data = await res.json();
                alert(data.error || "Update failed");
            }
        } catch {
            alert("Connection error.");
        } finally {
            setSaving(false);
        }
    };

    const handleGoalSave = async () => {
        setGoalSaving(true);
        try {
            const res = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    goal: goal || undefined,
                    trainingDaysPerWeek: Number(trainingDays) || undefined,
                    experienceLevel: experience || undefined,
                    trainingLocation: location || undefined,
                    targetWeightKg: targetWeight !== "" ? Math.round(Number(targetWeight) * 100) / 100 : undefined,
                    weightKg: currentWeight !== "" ? Math.round(Number(currentWeight) * 100) / 100 : undefined,
                    targetCalories: targetCalories !== "" ? Math.round(Number(targetCalories)) : null,
                    targetSteps: targetSteps !== "" ? Math.round(Number(targetSteps)) : null,
                    targetSleepHours: targetSleepHours !== "" ? Math.round(Number(targetSleepHours) * 10) / 10 : null,
                    hiddenGoals: hiddenGoals,
                })
            });
            if (res.ok) {
                setGoalSaved(true);
                router.refresh();
                setTimeout(() => setGoalSaved(false), 2500);
            } else {
                const data = await res.json();
                alert(data.error || "Failed to save goals");
            }
        } catch (err) {
            console.error(err);
            alert("Connection error occurred while saving goals.");
        } finally {
            setGoalSaving(false);
        }
    };

    const handleNotificationSave = async () => {
        setNotifSaving(true);
        try {
            const payload: Record<string, boolean | string | null> = {};
            if (showCoachNotifications) {
                payload.notifyOnWorkout = notifyOnWorkout;
                payload.notifyOnCheckIn = notifyOnCheckIn;
                payload.notifyOnMetricUpdate = notifyOnMetricUpdate;
                payload.notifyOnMissedCheckIn = notifyOnMissedCheckIn;
                payload.notifyOnMissedWorkout = notifyOnMissedWorkout;
                payload.notifyOnWorkoutTime = notifyOnWorkout && notifyOnWorkoutTime ? notifyOnWorkoutTime : null;
                payload.notifyOnCheckInTime = notifyOnCheckIn && notifyOnCheckInTime ? notifyOnCheckInTime : null;
                payload.notifyOnMetricUpdateTime = notifyOnMetricUpdate && notifyOnMetricUpdateTime ? notifyOnMetricUpdateTime : null;
                payload.notifyOnMissedCheckInTime = notifyOnMissedCheckIn ? notifyOnMissedCheckInTime : null;
                payload.notifyOnMissedWorkoutTime = notifyOnMissedWorkout ? notifyOnMissedWorkoutTime : null;
            }
            if (showClientNotifications) {
                payload.notifyOnCoachMessage = notifyOnCoachMessage;
                payload.notifyOnPlanUpdate = notifyOnPlanUpdate;
                payload.notifyOnCheckInReview = notifyOnCheckInReview;
                payload.notifyOnWorkoutFeedback = notifyOnWorkoutFeedback;
                payload.notifyOnMissedCheckIn = notifyOnMissedCheckIn;
            }

            const res = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                setNotifSaved(true);
                router.refresh();
                setTimeout(() => setNotifSaved(false), 2500);
            } else {
                const data = await res.json();
                alert(data.error || "Failed to save notification settings");
            }
        } catch {
            alert("Connection error.");
        } finally {
            setNotifSaving(false);
        }
    };

    const handleRedeemCode = async () => {
        if (!secretCode.trim()) return;
        setRedeeming(true);
        try {
            const res = await fetch("/api/codes/redeem", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: secretCode.trim() }),
            });
            if (res.ok) {
                alert("Success! Your access has been updated.");
                window.location.reload();
            } else {
                const data = await res.json();
                alert(data.error || "Invalid code");
            }
        } catch {
            alert("Connection error.");
        } finally {
            setRedeeming(false);
        }
    };

    const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "tonyolajide@gmail.com";

    return (
        <div className="max-w-4xl mx-auto p-6 flex flex-col md:flex-row gap-8 animate-fade-in pb-20">
            {/* Sidebar Tabs */}
            <div className="w-full md:w-64 space-y-2 shrink-0">
                {sections.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => setActiveTab(s.id)}
                        className={cn(
                            "w-full flex items-center justify-between p-3 rounded-xl transition-all",
                            activeTab === s.id
                                ? "bg-surface-elevated text-fg shadow-card border border-surface-border"
                                : "text-fg-muted hover:bg-surface-muted/50 hover:text-fg"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <s.icon className={cn("w-4 h-4", activeTab === s.id ? "text-brand-400" : "text-fg-subtle")} />
                            <span className="text-sm font-medium">{s.label}</span>
                        </div>
                        {activeTab === s.id && <ChevronRight className="w-4 h-4 text-brand-400" />}
                    </button>
                ))}

                <div className="pt-4 mt-4 border-t border-surface-border">
                    <button
                        onClick={() => signOut({ redirectUrl: "/" })}
                        className="w-full flex items-center gap-3 p-3 rounded-xl text-danger/60 hover:text-danger hover:bg-danger-muted/10 transition-all font-medium text-sm"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 space-y-6">
                {/* ─── Profile ─── */}
                {activeTab === "profile" && (
                    <div className="card p-8 space-y-8 animate-slide-up bg-gradient-to-br from-surface-card to-brand-950/5">
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                            <div className="flex flex-col items-center gap-2">
                            <div className="relative group">
                                <div className="w-24 h-24 rounded-3xl bg-surface-muted overflow-hidden border-2 border-surface-border shadow-glow-sm flex items-center justify-center">
                                    {avatarUrl ? (
                                        <img src={resolveUploadUrl(avatarUrl)} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-brand flex items-center justify-center text-2xl font-black text-white">
                                            {getInitials(name || user.email)}
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    disabled={uploading}
                                    className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-brand-500 text-white shadow-glow-brand hover:scale-110 transition-all flex items-center justify-center border-4 border-surface disabled:opacity-60 disabled:hover:scale-100"
                                    title="Change photo"
                                >
                                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                                </button>
                                <input type="file" ref={fileRef} onChange={handleUpload} className="hidden" accept="image/*" />
                            </div>
                            {avatarUrl && (
                                <button
                                    type="button"
                                    onClick={handleRemoveAvatar}
                                    disabled={uploading || saving}
                                    className="text-[10px] font-black uppercase tracking-widest text-fg-muted hover:text-danger transition-colors disabled:opacity-50"
                                >
                                    Remove photo
                                </button>
                            )}
                            </div>

                            <div className="text-center sm:text-left space-y-1">
                                <h3 className="text-2xl font-black text-fg tracking-tight">{name || "Athlete Identity"}</h3>
                                <p className="text-sm text-fg-muted">{user.email}</p>
                                <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
                                    <span className="px-3 py-1 rounded-full bg-brand-400/10 border border-brand-400/20 text-[10px] font-black text-brand-400 uppercase tracking-widest">{user.role}</span>
                                    {user.onboardingDone && <span className="px-3 py-1 rounded-full bg-success/10 border border-success/20 text-[10px] font-black text-success uppercase tracking-widest">Certified Athlete</span>}
                                </div>
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-fg-subtle uppercase tracking-widest px-1">Display Name</label>
                                <input
                                    type="text"
                                    className="input h-12 text-sm font-bold"
                                    placeholder="Your display name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-fg-subtle uppercase tracking-widest px-1">Email</label>
                                <input type="email" className="input h-12 bg-surface-muted/30 cursor-not-allowed text-fg-subtle" defaultValue={user.email} disabled />
                            </div>
                        </div>

                        {user.role === "FREE" && (
                            <div className="p-5 rounded-2xl bg-surface-muted/40 border border-surface-border space-y-3">
                                <p className="text-sm font-bold text-fg">Redeem access code</p>
                                <p className="text-xs text-fg-muted">Enter a code from your coach to unlock Premium features.</p>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="text"
                                        className="input h-11 flex-1 font-mono uppercase tracking-widest text-sm"
                                        placeholder="ACCESS CODE"
                                        value={secretCode}
                                        onChange={(e) => setSecretCode(e.target.value.toUpperCase())}
                                    />
                                    <button
                                        onClick={handleRedeemCode}
                                        disabled={redeeming || !secretCode.trim()}
                                        className="btn-primary h-11 px-6 text-xs font-black uppercase tracking-widest"
                                    >
                                        {redeeming ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Redeem"}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="pt-4 border-t border-surface-border flex justify-end">
                            <button
                                onClick={handleSave}
                                disabled={saving || uploading}
                                className="btn-primary w-full sm:w-auto px-10 h-12 shadow-glow-brand flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── Goals ─── */}
                {activeTab === "goals" && (
                    <div className="card p-8 space-y-8 animate-slide-up bg-gradient-to-br from-surface-card to-brand-950/5">
                        <div className="flex items-center gap-3 pb-2 border-b border-surface-border">
                            <div className="w-10 h-10 rounded-xl bg-brand-400/10 flex items-center justify-center">
                                <Target className="w-5 h-5 text-brand-400" />
                            </div>
                            <div>
                                <h3 className="font-black text-fg tracking-tight">My Goals</h3>
                                <p className="text-xs text-fg-muted">Edit your training goals and preferences below</p>
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-6">
                            {/* Primary Goal */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-fg-subtle uppercase tracking-widest px-1">Primary Goal</label>
                                <select
                                    value={goal}
                                    onChange={(e) => setGoal(e.target.value)}
                                    className="input h-12 text-sm font-bold appearance-none"
                                >
                                    <option value="">Select a goal</option>
                                    {Object.entries(GOAL_LABELS).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Experience Level */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-fg-subtle uppercase tracking-widest px-1">Experience Level</label>
                                <select
                                    value={experience}
                                    onChange={(e) => setExperience(e.target.value)}
                                    className="input h-12 text-sm font-bold appearance-none"
                                >
                                    <option value="">Select level</option>
                                    {Object.entries(EXP_LABELS).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>



                            {/* Training Days Per Week */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-fg-subtle uppercase tracking-widest px-1">
                                    Training Days Per Week — <span className="text-brand-400">{trainingDays} days</span>
                                </label>
                                <input
                                    type="range" min={1} max={7} step={1}
                                    value={trainingDays}
                                    onChange={(e) => setTrainingDays(Number(e.target.value))}
                                    className="w-full accent-brand-500 h-2 mt-3"
                                />
                                <div className="flex justify-between text-[10px] text-fg-subtle px-0.5">
                                    {[1,2,3,4,5,6,7].map(d => <span key={d}>{d}</span>)}
                                </div>
                            </div>

                            {/* Current Weight */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-fg-subtle uppercase tracking-widest px-1">Current Weight (kg)</label>
                                <input
                                    type="number" step="0.01"
                                    className="input h-12 text-sm font-bold"
                                    placeholder="e.g. 80"
                                    value={currentWeight}
                                    onChange={(e) => setCurrentWeight(e.target.value)}
                                />
                            </div>

                            {/* Target Weight */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-fg-subtle uppercase tracking-widest px-1">Target Weight (kg)</label>
                                <input
                                    type="number" step="0.01"
                                    className="input h-12 text-sm font-bold"
                                    placeholder="e.g. 75"
                                    value={targetWeight}
                                    onChange={(e) => setTargetWeight(e.target.value)}
                                />
                            </div>

                            {/* Daily Calories */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-fg-subtle uppercase tracking-widest px-1">Daily Calories</label>
                                <input
                                    type="number" step="1"
                                    className="input h-12 text-sm font-bold"
                                    placeholder="e.g. 2500"
                                    value={targetCalories}
                                    onChange={(e) => setTargetCalories(e.target.value)}
                                />
                            </div>

                            {/* Daily Steps */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-fg-subtle uppercase tracking-widest px-1">Daily Steps</label>
                                <input
                                    type="number" step="1"
                                    className="input h-12 text-sm font-bold"
                                    placeholder="e.g. 10000"
                                    value={targetSteps}
                                    onChange={(e) => setTargetSteps(e.target.value)}
                                />
                            </div>

                            {/* Sleep Goal */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-fg-subtle uppercase tracking-widest px-1">Sleep Goal (hours)</label>
                                <input
                                    type="number" step="0.1"
                                    className="input h-12 text-sm font-bold"
                                    placeholder="e.g. 8"
                                    value={targetSleepHours}
                                    onChange={(e) => setTargetSleepHours(e.target.value)}
                                />
                            </div>

                            {/* Goal Visibility settings */}
                            <div className="col-span-full border-t border-surface-border/50 pt-6 space-y-4">
                                <div>
                                    <h4 className="text-xs font-black text-fg uppercase tracking-widest">Dashboard & Progress Visibility</h4>
                                    <p className="text-[11px] text-fg-muted mt-0.5">Toggle which targets are visible on your dashboard and progress analytics. Hiding a target also hides it from your coach.</p>
                                </div>
                                
                                <div className="grid sm:grid-cols-2 gap-4">
                                    {[
                                        { key: "weight", label: "Bodyweight Goal & Trend", desc: "Show weight card and weight charts." },
                                        { key: "calories", label: "Calorie Intake Goal", desc: "Show calorie tracking card and logs." },
                                        { key: "steps", label: "Daily Steps Goal", desc: "Show steps target card and log inputs." },
                                        { key: "sleep", label: "Nightly Sleep Goal", desc: "Show sleep duration card and logs." },
                                    ].map((goalOpt) => {
                                        const isHidden = hiddenGoals.includes(goalOpt.key);
                                        return (
                                            <button
                                                key={goalOpt.key}
                                                type="button"
                                                onClick={() => {
                                                    if (isHidden) {
                                                        setHiddenGoals(hiddenGoals.filter(k => k !== goalOpt.key));
                                                    } else {
                                                        setHiddenGoals([...hiddenGoals, goalOpt.key]);
                                                    }
                                                }}
                                                className={cn(
                                                    "flex items-center justify-between p-4 rounded-2xl border text-left transition-all",
                                                    isHidden
                                                        ? "bg-surface-muted/30 border-surface-border hover:border-surface-border/80"
                                                        : "bg-brand-500/5 border-brand-500/30 hover:border-brand-500/50 shadow-glow-brand-sm"
                                                )}
                                            >
                                                <div className="min-w-0 pr-4">
                                                    <p className={cn("text-xs font-black uppercase tracking-wider", isHidden ? "text-fg-subtle" : "text-brand-400")}>
                                                        {goalOpt.label}
                                                    </p>
                                                    <p className="text-[10px] text-fg-muted mt-0.5">{goalOpt.desc}</p>
                                                </div>
                                                <div className={cn(
                                                    "w-10 h-6 p-0.5 rounded-full transition-colors relative shrink-0",
                                                    isHidden ? "bg-surface-muted border border-surface-border" : "bg-brand-500"
                                                )}>
                                                    <div className={cn(
                                                        "w-4 h-4 rounded-full bg-white transition-all shadow-sm absolute top-0.5",
                                                        isHidden ? "left-0.5" : "right-0.5"
                                                    )} />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Current snapshot */}
                        {(goal || experience || location) && (
                            <div className="p-4 rounded-2xl bg-brand-400/5 border border-brand-400/15 space-y-2">
                                <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-3">Current Profile</p>
                                <div className="flex flex-wrap gap-2">
                                    {goal && <span className="px-3 py-1 rounded-full bg-brand-400/10 border border-brand-400/20 text-xs font-bold text-brand-300">{GOAL_LABELS[goal] ?? goal}</span>}
                                    {experience && <span className="px-3 py-1 rounded-full bg-success/10 border border-success/20 text-xs font-bold text-success">{EXP_LABELS[experience] ?? experience}</span>}
                                    {trainingDays && <span className="px-3 py-1 rounded-full bg-surface-muted border border-surface-border text-xs font-bold text-fg-muted">{trainingDays}x / week</span>}
                                    {targetCalories && <span className="px-3 py-1 rounded-full bg-surface-muted border border-surface-border text-xs font-bold text-fg-muted">{Number(targetCalories).toLocaleString()} kcal</span>}
                                    {targetSteps && <span className="px-3 py-1 rounded-full bg-surface-muted border border-surface-border text-xs font-bold text-fg-muted">{Number(targetSteps).toLocaleString()} steps</span>}
                                    {targetSleepHours && <span className="px-3 py-1 rounded-full bg-surface-muted border border-surface-border text-xs font-bold text-fg-muted">{targetSleepHours}h sleep</span>}
                                </div>
                            </div>
                        )}

                        <div className="pt-4 border-t border-surface-border flex justify-end">
                            <button
                                onClick={handleGoalSave}
                                disabled={goalSaving}
                                className={cn(
                                    "btn-primary w-full sm:w-auto px-10 h-12 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all",
                                    goalSaved && "bg-success border-success shadow-glow-success"
                                )}
                            >
                                {goalSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : goalSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                                {goalSaving ? "Saving..." : goalSaved ? "Goals Saved!" : "Save Goals"}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === "notifications" && (
                    <div className="card p-6 space-y-6 animate-slide-up">
                        <div>
                            <h3 className="heading-3">Activity Notifications</h3>
                            <p className="text-sm text-fg-muted mt-1">
                                Choose which in-app alerts you receive. Changes apply immediately.
                            </p>
                        </div>

                        {showCoachNotifications && (
                            <div className="space-y-3">
                                <p className="text-xs font-black uppercase tracking-widest text-fg-subtle">Coach alerts</p>
                                <CoachNotificationToggle
                                    label="Client completes a workout"
                                    description="When a client finishes a logged session."
                                    checked={notifyOnWorkout}
                                    onChange={setNotifyOnWorkout}
                                    time={notifyOnWorkoutTime}
                                    onTimeChange={setNotifyOnWorkoutTime}
                                    timeHint="Leave blank for instant alerts. Set a time to batch until then each day."
                                />
                                <CoachNotificationToggle
                                    label="Client submits a check-in"
                                    description="When a client sends a weekly check-in."
                                    checked={notifyOnCheckIn}
                                    onChange={setNotifyOnCheckIn}
                                    time={notifyOnCheckInTime}
                                    onTimeChange={setNotifyOnCheckInTime}
                                    timeHint="Leave blank for instant alerts."
                                />
                                <CoachNotificationToggle
                                    label="Client logs bodyweight"
                                    description="When a client records their weight on the dashboard."
                                    checked={notifyOnMetricUpdate}
                                    onChange={setNotifyOnMetricUpdate}
                                    time={notifyOnMetricUpdateTime}
                                    onTimeChange={setNotifyOnMetricUpdateTime}
                                    timeHint="Leave blank for instant alerts."
                                />
                                <CoachNotificationToggle
                                    label="Client misses a scheduled check-in"
                                    description="Daily summary when a client has not submitted their due check-in."
                                    checked={notifyOnMissedCheckIn}
                                    onChange={setNotifyOnMissedCheckIn}
                                    time={notifyOnMissedCheckInTime}
                                    onTimeChange={setNotifyOnMissedCheckInTime}
                                    requireTime
                                    timeHint="Checked once per day at this time."
                                />
                                <CoachNotificationToggle
                                    label="Client misses a scheduled workout"
                                    description="Daily summary when a client did not complete today's planned session."
                                    checked={notifyOnMissedWorkout}
                                    onChange={setNotifyOnMissedWorkout}
                                    time={notifyOnMissedWorkoutTime}
                                    onTimeChange={setNotifyOnMissedWorkoutTime}
                                    requireTime
                                    timeHint="Checked once per day at this time."
                                />
                            </div>
                        )}

                        {showClientNotifications && (
                            <div className="space-y-3">
                                <p className="text-xs font-black uppercase tracking-widest text-fg-subtle">Client alerts</p>
                                <NotificationToggle
                                    label="Coach sends a message"
                                    description="When your coach messages you in chat."
                                    checked={notifyOnCoachMessage}
                                    onChange={setNotifyOnCoachMessage}
                                />
                                <NotificationToggle
                                    label="Plan updated or assigned"
                                    description="When your coach changes or assigns your programme."
                                    checked={notifyOnPlanUpdate}
                                    onChange={setNotifyOnPlanUpdate}
                                />
                                <NotificationToggle
                                    label="Check-in reviewed"
                                    description="When your coach responds to a check-in."
                                    checked={notifyOnCheckInReview}
                                    onChange={setNotifyOnCheckInReview}
                                />
                                <NotificationToggle
                                    label="Workout feedback added"
                                    description="When your coach leaves notes on a session."
                                    checked={notifyOnWorkoutFeedback}
                                    onChange={setNotifyOnWorkoutFeedback}
                                />
                                <NotificationToggle
                                    label="Missed check-in reminder"
                                    description="Daily reminder when your weekly check-in is due or overdue."
                                    checked={notifyOnMissedCheckIn}
                                    onChange={setNotifyOnMissedCheckIn}
                                />
                            </div>
                        )}

                        <div className="pt-4 border-t border-surface-border flex justify-end">
                            <button
                                onClick={handleNotificationSave}
                                disabled={notifSaving}
                                className={cn(
                                    "btn-primary w-full sm:w-auto px-10 h-12 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all",
                                    notifSaved && "bg-success border-success shadow-glow-success"
                                )}
                            >
                                {notifSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : notifSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                                {notifSaving ? "Saving..." : notifSaved ? "Saved!" : "Save Notifications"}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === "appearance" && (
                    <div className="card p-8 space-y-8 animate-slide-up">
                        <div>
                            <h3 className="text-xl font-bold text-fg mb-1">Theme Presets</h3>
                            <p className="text-sm text-fg-muted">Choose a visual style that matches your energy levels.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { id: "midnight", name: "Midnight Glow", desc: "Default indigo/purple aesthetic", bg: "bg-[#6366f1]" },
                                { id: "emerald", name: "Electric Emerald", desc: "Vibrant greens for performance", bg: "bg-[#10b981]" },
                                { id: "solar", name: "Solar Flare", desc: "Energetic orange and ambers", bg: "bg-[#f59e0b]" },
                                { id: "ocean", name: "Ocean Breeze", desc: "Cool cyans and deep blues", bg: "bg-[#06b6d4]" },
                                { id: "rose", name: "Crimson Peak", desc: "High intensity red tones", bg: "bg-[#f43f5e]" },
                            ].map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => setTheme(t.id)}
                                    className={cn(
                                        "p-4 rounded-2xl border transition-all text-left flex items-start gap-4 group hover:border-brand-500/50",
                                        theme === t.id ? "bg-brand-500/10 border-brand-500 shadow-glow-sm" : "bg-surface-muted/50 border-surface-border"
                                    )}
                                >
                                    <div className={cn("w-10 h-10 rounded-xl shrink-0 shadow-sm transition-transform group-hover:scale-105", t.bg)} />
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <p className="text-sm font-bold text-fg">{t.name}</p>
                                            {theme === t.id && <Check className="w-4 h-4 text-brand-400" />}
                                        </div>
                                        <p className="text-xs text-fg-muted transition-colors group-hover:text-fg-subtle">{t.desc}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}



                {/* Support Card */}
                <div className="card p-6 border-brand-800/20 bg-brand-950/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-brand-900/40 flex items-center justify-center">
                            <HelpCircle className="w-6 h-6 text-brand-400" />
                        </div>
                        <div>
                            <h4 className="font-bold text-fg">Need help?</h4>
                            <p className="text-sm text-fg-muted">Email {supportEmail} or support the app.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                        <Link href="/donate" className="btn-ghost whitespace-nowrap text-xs font-bold uppercase tracking-wide">
                            Support the app
                        </Link>
                        <button
                            type="button"
                            onClick={() => { window.location.href = `mailto:${supportEmail}`; }}
                            className="btn-secondary whitespace-nowrap"
                        >
                            Contact Support
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function CoachNotificationToggle({
    label,
    description,
    checked,
    onChange,
    time,
    onTimeChange,
    requireTime = false,
    timeHint,
}: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (value: boolean) => void;
    time: string;
    onTimeChange: (value: string) => void;
    requireTime?: boolean;
    timeHint?: string;
}) {
    return (
        <div className="p-4 rounded-2xl border border-surface-border bg-surface-muted/30 space-y-3">
            <NotificationToggle
                label={label}
                description={description}
                checked={checked}
                onChange={onChange}
            />
            {checked && (
                <div className="pl-1 space-y-1.5 border-t border-surface-border/60 pt-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">
                        {requireTime ? "Daily alert time" : "Delivery time (optional)"}
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            type="time"
                            className="input h-10 w-full max-w-[160px] text-sm font-bold"
                            value={time}
                            required={requireTime}
                            onChange={(e) => onTimeChange(e.target.value)}
                        />
                        {time && (
                            <button
                                type="button"
                                onClick={() => onTimeChange(requireTime ? DEFAULT_MISSED_NOTIFY_TIME : "")}
                                className="btn-icon h-10 w-10 shrink-0 text-fg-subtle hover:text-fg"
                                title={requireTime ? "Reset to default time" : "Clear time"}
                                aria-label={requireTime ? "Reset to default time" : "Clear time"}
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    {timeHint && (
                        <p className="text-[11px] text-fg-muted">{timeHint}</p>
                    )}
                </div>
            )}
        </div>
    );
}

function NotificationToggle({
    label,
    description,
    checked,
    onChange,
}: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <label className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-surface-border bg-surface-muted/30 cursor-pointer hover:border-brand-500/30 transition-colors">
            <div>
                <p className="text-sm font-bold text-fg">{label}</p>
                <p className="text-xs text-fg-muted mt-0.5">{description}</p>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                className={cn(
                    "relative w-11 h-6 rounded-full shrink-0 transition-colors",
                    checked ? "bg-brand-500" : "bg-surface-border"
                )}
            >
                <span
                    className={cn(
                        "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform",
                        checked && "translate-x-5"
                    )}
                />
            </button>
        </label>
    );
}
