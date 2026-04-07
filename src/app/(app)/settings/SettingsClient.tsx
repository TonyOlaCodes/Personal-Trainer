"use client";

import { useState, useRef } from "react";
import {
    User, Bell, Shield, CreditCard, Palette,
    HelpCircle, LogOut, ChevronRight, Check,
    Camera, Loader2, Save, Heart, Copy, Target, Edit3, Zap
} from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";
import { cn, getInitials } from "@/lib/utils";

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
    const [goalSaving, setGoalSaving] = useState(false);
    const [goalSaved, setGoalSaved] = useState(false);

    // Access code state
    const [secretCode, setSecretCode] = useState("");
    const [redeeming, setRedeeming] = useState(false);

    const sections = [
        { id: "profile", label: "Profile", icon: User },
        { id: "goals", label: "My Goals", icon: Target },
        { id: "appearance", label: "Appearance", icon: Palette },
        { id: "notifications", label: "Notifications", icon: Bell },
        { id: "billing", label: "Billing", icon: CreditCard },
        { id: "contribute", label: "Contribute", icon: Heart },
    ];

    const [theme, setTheme] = useState(typeof window !== "undefined" ? localStorage.getItem("pt-theme") || "midnight" : "midnight");

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("pt-theme", theme);
    }, [theme]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || uploading) return;
        setUploading(true);
        const fd = new FormData();
        fd.append("file", file);
        try {
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            const data = await res.json();
            if (res.ok) setAvatarUrl(data.url);
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, avatarUrl })
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
                })
            });
            if (res.ok) {
                setGoalSaved(true);
                setTimeout(() => setGoalSaved(false), 2500);
            }
        } finally {
            setGoalSaving(false);
        }
    };

    const handleRedeemCode = async () => {
        if (!secretCode.trim()) return;
        setRedeeming(true);
        try {
            const res = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ secretCode })
            });
            if (res.ok) {
                alert("Success! Your role has been updated.");
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
                            <div className="relative group">
                                <div className="w-24 h-24 rounded-3xl bg-surface-muted overflow-hidden border-2 border-surface-border shadow-glow-sm flex items-center justify-center">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-brand flex items-center justify-center text-2xl font-black text-white">
                                            {getInitials(name || user.email)}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => fileRef.current?.click()}
                                    className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-brand-500 text-white shadow-glow-brand hover:scale-110 transition-all flex items-center justify-center border-4 border-surface"
                                >
                                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                                </button>
                                <input type="file" ref={fileRef} onChange={handleUpload} className="hidden" accept="image/*" />
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
                                    placeholder="e.g. Tony Olajide"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-fg-subtle uppercase tracking-widest px-1">Email</label>
                                <input type="email" className="input h-12 bg-surface-muted/30 cursor-not-allowed text-fg-subtle" defaultValue={user.email} disabled />
                            </div>
                        </div>

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

                            {/* Training Location */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-fg-subtle uppercase tracking-widest px-1">Where do you train?</label>
                                <select
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    className="input h-12 text-sm font-bold appearance-none"
                                >
                                    <option value="">Select location</option>
                                    {Object.entries(LOC_LABELS).map(([k, v]) => (
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
                        </div>

                        {/* Current snapshot */}
                        {(goal || experience || location) && (
                            <div className="p-4 rounded-2xl bg-brand-400/5 border border-brand-400/15 space-y-2">
                                <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-3">Current Profile</p>
                                <div className="flex flex-wrap gap-2">
                                    {goal && <span className="px-3 py-1 rounded-full bg-brand-400/10 border border-brand-400/20 text-xs font-bold text-brand-300">{GOAL_LABELS[goal] ?? goal}</span>}
                                    {experience && <span className="px-3 py-1 rounded-full bg-success/10 border border-success/20 text-xs font-bold text-success">{EXP_LABELS[experience] ?? experience}</span>}
                                    {location && <span className="px-3 py-1 rounded-full bg-warning/10 border border-warning/20 text-xs font-bold text-warning">{LOC_LABELS[location] ?? location}</span>}
                                    {trainingDays && <span className="px-3 py-1 rounded-full bg-surface-muted border border-surface-border text-xs font-bold text-fg-muted">{trainingDays}x / week</span>}
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
                        <h3 className="heading-3">Activity Notifications</h3>
                        <div className="space-y-4">
                            {[
                                { label: "Workout Reminders", desc: "Get notified if you miss a scheduled session." },
                                { label: "Coach Messages", desc: "Instant alerts when your coach replies to you." },
                                { label: "Community Updates", desc: "Stay tuned for platform updates." },
                            ].map((n, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-surface-muted/30 rounded-2xl border border-surface-border">
                                    <div>
                                        <p className="text-sm font-semibold text-fg">{n.label}</p>
                                        <p className="text-xs text-fg-muted">{n.desc}</p>
                                    </div>
                                    <div className="toggle-switch active" />
                                </div>
                            ))}
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

                {activeTab === "billing" && (
                    <div className="card p-8 space-y-8 animate-slide-up">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-brand-400/10 rounded-2xl flex items-center justify-center">
                                <CreditCard className="w-6 h-6 text-brand-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-fg">Subscription</h3>
                                <p className="text-sm text-fg-muted">Manage your billing and plan access.</p>
                            </div>
                        </div>

                        <div className="p-6 bg-surface-muted/30 rounded-2xl border border-surface-border flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-bold text-fg">Current Tier: {user.role === "FREE" ? "Free" : "Premium Member"}</p>
                                <p className="text-xs text-fg-subtle">You have full access to all assigned training blocks.</p>
                            </div>
                            {user.role === "FREE" && (
                                <button className="btn-primary btn-sm px-6">Upgrade to Premium</button>
                            )}
                        </div>

                        {/* Special Code Section */}
                        <div className="p-8 bg-gradient-brand-subtle rounded-3xl border border-brand-500/20 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Zap className="w-4 h-4 text-brand-400 group-hover:animate-pulse-brand" />
                                <h4 className="font-black text-fg tracking-tight uppercase text-xs">Redeem Athlete Code</h4>
                            </div>
                            <p className="text-xs text-fg-muted">
                                If you have a dedicated trainer code or a promotional access key, enter it below to unlock premium dashboard features.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-2 mt-4">
                                <input
                                    type="text"
                                    placeholder="ENTER CODE..."
                                    className="input h-12 flex-1 font-mono uppercase tracking-widest text-sm font-black border-brand-500/20 focus:border-brand-500 bg-brand-950/20"
                                    value={secretCode}
                                    onChange={(e) => setSecretCode(e.target.value)}
                                />
                                <button
                                    onClick={handleRedeemCode}
                                    disabled={redeeming || !secretCode.trim()}
                                    className="btn-primary h-12 px-8 shadow-glow-brand text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                                >
                                    {redeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : "Unlock Now"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "contribute" && (
                    <div className="card p-8 space-y-8 animate-slide-up bg-gradient-to-br from-surface-card to-brand-950/10 border-brand-500/20">
                        <div className="text-center space-y-3">
                            <div className="w-16 h-16 bg-brand-400/10 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-glow-brand-sm">
                                <Heart className="w-8 h-8 text-brand-400 fill-brand-400/20" />
                            </div>
                            <h3 className="text-2xl font-black text-fg tracking-tight">Support the Platform</h3>
                            <p className="text-sm text-fg-muted max-w-md mx-auto">
                                We are committed to building the most professional training platform available. Your contributions help us maintain infrastructure and develop elite features.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="p-6 bg-surface-card rounded-2xl border border-surface-border shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-fg-subtle uppercase tracking-widest">Account Holder</span>
                                    <button
                                        className="text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest"
                                        onClick={() => { navigator.clipboard.writeText("Tony Olajide"); alert("Copied!"); }}
                                    >
                                        <Copy className="w-3 h-3" /> Copy
                                    </button>
                                </div>
                                <p className="text-lg font-black text-fg tracking-tight">Tony Olajide</p>
                            </div>

                            <div className="p-6 bg-surface-card rounded-2xl border border-surface-border shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-fg-subtle uppercase tracking-widest">IBAN</span>
                                    <button
                                        className="text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest"
                                        onClick={() => { navigator.clipboard.writeText("IE40AIBK93324457543025"); alert("Copied!"); }}
                                    >
                                        <Copy className="w-3 h-3" /> Copy
                                    </button>
                                </div>
                                <p className="text-lg font-black text-fg font-mono tracking-wider break-all">IE40 AIBK 9332 4457 5430 25</p>
                            </div>
                        </div>

                        <div className="p-4 bg-brand-400/5 rounded-xl border border-brand-400/10 text-center">
                            <p className="text-xs text-brand-400 font-bold italic">"Strength is built together."</p>
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
                            <p className="text-sm text-fg-muted">Our support team is active 24/7 for you.</p>
                        </div>
                    </div>
                    <button className="btn-secondary whitespace-nowrap">Contact Support</button>
                </div>
            </div>
        </div>
    );
}
