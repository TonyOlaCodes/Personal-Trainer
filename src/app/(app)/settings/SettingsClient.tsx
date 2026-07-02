"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    User, Bell, Palette,
    HelpCircle, LogOut, ChevronRight, Check,
    Camera, Loader2, Target, ImageIcon, Link2, ArrowLeft,
} from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn, getInitials } from "@/lib/utils";
import { resolveUploadUrl, uploadMediaFile } from "@/lib/compressImage";
import { ImageCropModal } from "@/components/shared/ImageCropModal";
import { isCoachRole, isClientRole, isCoachedPremium } from "@/lib/roles";
import {
    type SocialLinks,
} from "@/lib/profilePrivacy";
import { getPublicProfileHref } from "@/lib/profileNavigation";
import { siteConfig } from "@/lib/site";

interface Props {
    user: {
        id: string;
        name?: string | null;
        email: string;
        role: string;
        coachId?: string | null;
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
        notifyOnClientMessage?: boolean;
        bio?: string | null;
        isPrivateProfile?: boolean;
        bannerUrl?: string | null;
        socialLinks?: SocialLinks;
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
    const searchParams = useSearchParams();

    // Profile form states
    const [name, setName] = useState(user.name || "");
    const [bio, setBio] = useState(user.bio || "");
    const [isPrivateProfile, setIsPrivateProfile] = useState(user.isPrivateProfile ?? false);
    const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
    const [bannerUrl, setBannerUrl] = useState(user.bannerUrl || "");
    const [socialLinks, setSocialLinks] = useState<SocialLinks>(user.socialLinks ?? {});
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileSaved, setProfileSaved] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [bannerUploading, setBannerUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const bannerRef = useRef<HTMLInputElement>(null);
    const profileReadyRef = useRef(false);
    const [cropState, setCropState] = useState<{
        imageSrc: string;
        target: "avatar" | "banner";
        fileName: string;
    } | null>(null);

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
    const goalReadyRef = useRef(false);

    const showCoachNotifications = isCoachRole(user.role);
    const showClientNotifications = isCoachedPremium(user.role, user.coachId);

    const sections = [
        { id: "profile", label: "Profile", icon: User },
        ...(isClientRole(user.role) ? [{ id: "goals", label: "My Goals", icon: Target }] : []),
        { id: "appearance", label: "Appearance", icon: Palette },
        { id: "notifications", label: "Notifications", icon: Bell },
    ];

    const sectionParam = searchParams.get("section");
    const sectionIds = sections.map((section) => section.id);
    const activeSection =
        sectionParam && sectionIds.includes(sectionParam) ? sectionParam : null;
    const activeSectionMeta = sections.find((section) => section.id === activeSection);

    const [notifyOnWorkout, setNotifyOnWorkout] = useState(user.notifyOnWorkout ?? true);
    const [notifyOnCheckIn, setNotifyOnCheckIn] = useState(user.notifyOnCheckIn ?? true);
    const [notifyOnMetricUpdate, setNotifyOnMetricUpdate] = useState(user.notifyOnMetricUpdate ?? true);
    const [notifyOnCoachMessage, setNotifyOnCoachMessage] = useState(user.notifyOnCoachMessage ?? true);
    const [notifyOnPlanUpdate, setNotifyOnPlanUpdate] = useState(user.notifyOnPlanUpdate ?? true);
    const [notifyOnCheckInReview, setNotifyOnCheckInReview] = useState(user.notifyOnCheckInReview ?? true);
    const [notifyOnWorkoutFeedback, setNotifyOnWorkoutFeedback] = useState(user.notifyOnWorkoutFeedback ?? true);
    const [notifyOnMissedCheckIn, setNotifyOnMissedCheckIn] = useState(user.notifyOnMissedCheckIn ?? true);
    const [notifyOnClientMessage, setNotifyOnClientMessage] = useState(user.notifyOnClientMessage ?? true);
    const [notifSaving, setNotifSaving] = useState(false);
    const [notifSaved, setNotifSaved] = useState(false);
    const notifReadyRef = useRef(false);

    const buildNotificationPayload = useCallback((): Record<string, boolean | string | null> => {
        const payload: Record<string, boolean | string | null> = {};
        if (showCoachNotifications) {
            payload.notifyOnWorkout = notifyOnWorkout;
            payload.notifyOnCheckIn = notifyOnCheckIn;
            payload.notifyOnMetricUpdate = notifyOnMetricUpdate;
            payload.notifyOnClientMessage = notifyOnClientMessage;
        }
        if (showClientNotifications) {
            payload.notifyOnCoachMessage = notifyOnCoachMessage;
            payload.notifyOnPlanUpdate = notifyOnPlanUpdate;
            payload.notifyOnCheckInReview = notifyOnCheckInReview;
            payload.notifyOnWorkoutFeedback = notifyOnWorkoutFeedback;
            payload.notifyOnMissedCheckIn = notifyOnMissedCheckIn;
        }
        return payload;
    }, [
        showCoachNotifications,
        showClientNotifications,
        notifyOnWorkout,
        notifyOnCheckIn,
        notifyOnMetricUpdate,
        notifyOnMissedCheckIn,
        notifyOnClientMessage,
        notifyOnCoachMessage,
        notifyOnPlanUpdate,
        notifyOnCheckInReview,
        notifyOnWorkoutFeedback,
    ]);

    useEffect(() => {
        if (activeSection !== "notifications") return;
        if (!notifReadyRef.current) {
            notifReadyRef.current = true;
            return;
        }

        const timer = window.setTimeout(async () => {
            setNotifSaving(true);
            setNotifSaved(false);
            try {
                const res = await fetch("/api/user/profile", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(buildNotificationPayload()),
                });
                if (res.ok) {
                    setNotifSaved(true);
                    router.refresh();
                    window.setTimeout(() => setNotifSaved(false), 2000);
                } else {
                    const data = await res.json();
                    alert(data.error || "Failed to save notification settings");
                }
            } catch {
                alert("Connection error.");
            } finally {
                setNotifSaving(false);
            }
        }, 450);

        return () => window.clearTimeout(timer);
    }, [activeSection, buildNotificationPayload, router]);

    const saveProfileFields = useCallback(async (fields: {
        name?: string;
        avatarUrl?: string;
        bannerUrl?: string;
        bio?: string | null;
        isPrivateProfile?: boolean;
        socialLinks?: SocialLinks;
    }) => {
        setProfileSaving(true);
        setProfileSaved(false);
        try {
            const res = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(fields),
            });
            if (res.ok) {
                setProfileSaved(true);
                router.refresh();
                window.setTimeout(() => setProfileSaved(false), 2000);
            } else {
                const data = await res.json();
                alert(data.error || "Failed to save profile");
            }
        } catch {
            alert("Connection error.");
        } finally {
            setProfileSaving(false);
        }
    }, [router]);

    useEffect(() => {
        if (activeSection !== "profile") return;
        if (!profileReadyRef.current) {
            profileReadyRef.current = true;
            return;
        }

        const timer = window.setTimeout(() => {
            void saveProfileFields({
                name,
                avatarUrl: avatarUrl || "",
                bannerUrl: bannerUrl || "",
                bio: bio.trim() ? bio.trim() : null,
                isPrivateProfile,
                socialLinks,
            });
        }, 450);

        return () => window.clearTimeout(timer);
    }, [activeSection, name, avatarUrl, bannerUrl, bio, isPrivateProfile, socialLinks, saveProfileFields]);

    // Access code state
    const [secretCode, setSecretCode] = useState("");
    const [redeeming, setRedeeming] = useState(false);

    const [theme, setTheme] = useState(typeof window !== "undefined" ? localStorage.getItem("pt-theme") || "midnight" : "midnight");

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("pt-theme", theme);
    }, [theme]);

    const closeCropModal = useCallback(() => {
        setCropState((current) => {
            if (current?.imageSrc) URL.revokeObjectURL(current.imageSrc);
            return null;
        });
    }, []);

    const openCropModal = (file: File, target: "avatar" | "banner") => {
        if (!file.type.startsWith("image/")) {
            alert("Please choose an image file.");
            return;
        }
        setCropState({
            imageSrc: URL.createObjectURL(file),
            target,
            fileName: file.name,
        });
    };

    const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (fileRef.current) fileRef.current.value = "";
        if (!file || uploading) return;
        openCropModal(file, "avatar");
    };

    const handleBannerFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (bannerRef.current) bannerRef.current.value = "";
        if (!file || bannerUploading) return;
        openCropModal(file, "banner");
    };

    const handleCropConfirm = async (file: File) => {
        const target = cropState?.target;
        if (!target) return;

        if (target === "avatar") {
            setUploading(true);
            try {
                const url = await uploadMediaFile(file);
                setAvatarUrl(url);
                closeCropModal();
            } catch (error) {
                alert(error instanceof Error ? error.message : "Upload failed");
            } finally {
                setUploading(false);
            }
            return;
        }

        setBannerUploading(true);
        try {
            const url = await uploadMediaFile(file);
            setBannerUrl(url);
            closeCropModal();
        } catch (error) {
            alert(error instanceof Error ? error.message : "Upload failed");
        } finally {
            setBannerUploading(false);
        }
    };

    const handleRemoveAvatar = () => {
        setAvatarUrl("");
        if (fileRef.current) fileRef.current.value = "";
    };

    const handleRemoveBanner = () => {
        setBannerUrl("");
        if (bannerRef.current) bannerRef.current.value = "";
    };

    const updateSocialLink = (key: keyof SocialLinks, value: string) => {
        setSocialLinks((prev) => ({ ...prev, [key]: value }));
    };

    const buildGoalPayload = useCallback(() => ({
        goal: goal || undefined,
        trainingDaysPerWeek: Number(trainingDays) || undefined,
        experienceLevel: experience || undefined,
        trainingLocation: location || undefined,
        targetWeightKg: targetWeight !== "" ? Math.round(Number(targetWeight) * 100) / 100 : undefined,
        weightKg: currentWeight !== "" ? Math.round(Number(currentWeight) * 100) / 100 : undefined,
        targetCalories: targetCalories !== "" ? Math.round(Number(targetCalories)) : null,
        targetSteps: targetSteps !== "" ? Math.round(Number(targetSteps)) : null,
        targetSleepHours: targetSleepHours !== "" ? Math.round(Number(targetSleepHours) * 10) / 10 : null,
        hiddenGoals,
    }), [
        goal,
        trainingDays,
        experience,
        location,
        targetWeight,
        currentWeight,
        targetCalories,
        targetSteps,
        targetSleepHours,
        hiddenGoals,
    ]);

    useEffect(() => {
        if (activeSection !== "goals") return;
        if (!goalReadyRef.current) {
            goalReadyRef.current = true;
            return;
        }

        const timer = window.setTimeout(async () => {
            setGoalSaving(true);
            setGoalSaved(false);
            try {
                const res = await fetch("/api/user/profile", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(buildGoalPayload()),
                });
                if (res.ok) {
                    setGoalSaved(true);
                    router.refresh();
                    window.setTimeout(() => setGoalSaved(false), 2000);
                } else {
                    const data = await res.json();
                    alert(data.error || "Failed to save goals");
                }
            } catch {
                alert("Connection error occurred while saving goals.");
            } finally {
                setGoalSaving(false);
            }
        }, 450);

        return () => window.clearTimeout(timer);
    }, [activeSection, buildGoalPayload, router]);

    useEffect(() => {
        return () => {
            if (cropState?.imageSrc) URL.revokeObjectURL(cropState.imageSrc);
        };
    }, [cropState?.imageSrc]);

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

    const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? siteConfig.contactEmail;

    return (
        <>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 animate-fade-in pb-20">
            {!activeSection ? (
                <div className="space-y-6">
                    <div className="space-y-2">
                        {sections.map((section) => (
                            <Link
                                key={section.id}
                                href={`/settings?section=${section.id}`}
                                className="card p-4 flex items-center justify-between gap-3 hover:border-brand-500/30 transition-colors"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-surface-muted border border-surface-border flex items-center justify-center shrink-0">
                                        <section.icon className="w-4 h-4 text-brand-400" />
                                    </div>
                                    <span className="text-sm font-bold text-fg">{section.label}</span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-fg-subtle shrink-0" />
                            </Link>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={() => signOut({ redirectUrl: "/" })}
                        className="w-full card p-4 flex items-center gap-3 text-danger/70 hover:text-danger hover:border-danger/30 transition-colors font-medium text-sm"
                    >
                        <LogOut className="w-4 h-4 shrink-0" />
                        Sign Out
                    </button>

                    <div className="space-y-2">
                        <div className="card p-6 border-brand-800/20 bg-brand-950/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-brand-900/40 flex items-center justify-center">
                                    <HelpCircle className="w-6 h-6 text-brand-400" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-fg">Need help?</h4>
                                    <p className="text-[15px] text-fg-muted leading-snug">Email {supportEmail} or support the app.</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 justify-end">
                                <Link href="/donate" className="btn-ghost whitespace-nowrap font-bold uppercase tracking-wide">
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
                        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-1 text-xs text-fg-subtle">
                            <Link href="/privacy" className="hover:text-brand-400 transition-colors">
                                Privacy Policy
                            </Link>
                            <span aria-hidden="true">·</span>
                            <Link href="/terms" className="hover:text-brand-400 transition-colors">
                                Terms of Service
                            </Link>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <button
                        type="button"
                        onClick={() => router.push("/settings")}
                        className="inline-flex items-center gap-2 text-sm font-bold text-fg-muted hover:text-fg transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to settings
                    </button>

                    {activeSectionMeta && (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-brand-400/10 border border-brand-400/20 flex items-center justify-center shrink-0">
                                <activeSectionMeta.icon className="w-4 h-4 text-brand-400" />
                            </div>
                            <h2 className="text-xl font-black text-fg">{activeSectionMeta.label}</h2>
                        </div>
                    )}

                    <div className="space-y-6">
                {activeSection === "profile" && (
                    <div className="card p-8 space-y-8 animate-slide-up bg-gradient-to-br from-surface-card to-brand-950/5">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-col sm:flex-row items-center gap-6 flex-1 min-w-0">
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
                                <input type="file" ref={fileRef} onChange={handleAvatarFileSelect} className="hidden" accept="image/*" />
                            </div>
                            {avatarUrl && (
                                <button
                                    type="button"
                                    onClick={handleRemoveAvatar}
                                    disabled={uploading || profileSaving}
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
                            {(profileSaving || profileSaved) && (
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-widest shrink-0",
                                    profileSaving ? "text-fg-muted" : "text-success"
                                )}>
                                    {profileSaving ? "Saving…" : "Saved"}
                                </span>
                            )}
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

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-fg-subtle uppercase tracking-widest px-1">Bio</label>
                            <textarea
                                className="input min-h-[96px] text-sm font-medium resize-y"
                                placeholder="Tell others a little about your training (optional)"
                                maxLength={280}
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                            />
                            <p className="text-[10px] text-fg-subtle px-1">{bio.length}/280</p>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-fg-subtle uppercase tracking-widest px-1 flex items-center gap-2">
                                <ImageIcon className="w-3.5 h-3.5" />
                                Profile banner
                            </label>
                            <div className="relative rounded-2xl overflow-hidden border border-surface-border bg-surface-muted/40 h-32 sm:h-36">
                                {bannerUrl ? (
                                    <img
                                        src={resolveUploadUrl(bannerUrl)}
                                        alt="Profile banner"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-brand-500/20 via-surface-muted to-brand-950/30" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                                <div className="absolute bottom-3 right-3 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => bannerRef.current?.click()}
                                        disabled={bannerUploading}
                                        className="px-3 py-1.5 rounded-xl bg-black/50 backdrop-blur text-[10px] font-black uppercase tracking-widest text-white hover:bg-black/70 transition-colors disabled:opacity-60"
                                    >
                                        {bannerUploading ? "Uploading…" : bannerUrl ? "Change" : "Upload"}
                                    </button>
                                    {bannerUrl && (
                                        <button
                                            type="button"
                                            onClick={handleRemoveBanner}
                                            disabled={bannerUploading || profileSaving}
                                            className="px-3 py-1.5 rounded-xl bg-black/50 backdrop-blur text-[10px] font-black uppercase tracking-widest text-white hover:bg-black/70 transition-colors disabled:opacity-60"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                                <input type="file" ref={bannerRef} onChange={handleBannerFileSelect} className="hidden" accept="image/*" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-fg-subtle uppercase tracking-widest px-1 flex items-center gap-2">
                                <Link2 className="w-3.5 h-3.5" />
                                Social links
                            </label>
                            <div className="grid sm:grid-cols-2 gap-4">
                                {([
                                    ["instagram", "Instagram"],
                                    ["tiktok", "TikTok"],
                                    ["youtube", "YouTube"],
                                    ["website", "Website"],
                                ] as const).map(([key, label]) => (
                                    <div key={key} className="space-y-2">
                                        <label className="text-[10px] font-bold text-fg-muted uppercase tracking-widest px-1">{label}</label>
                                        <input
                                            type="text"
                                            className="input h-11 text-sm"
                                            placeholder={key === "website" ? "https://yoursite.com" : `@username or URL`}
                                            value={socialLinks[key] ?? ""}
                                            onChange={(e) => updateSocialLink(key, e.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-5 rounded-2xl border border-surface-border bg-surface-muted/30 space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-sm font-black text-fg">Private account</p>
                                    <p className="text-xs text-fg-muted mt-1 leading-relaxed">
                                        When private, others only see your photo, name, username, coach, and online status.
                                        Your assigned coach and admins can still view your full profile.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isPrivateProfile}
                                    onClick={() => setIsPrivateProfile((prev) => !prev)}
                                    className={cn(
                                        "relative w-11 h-6 rounded-full transition-colors shrink-0",
                                        isPrivateProfile ? "bg-brand-500" : "bg-surface-muted border border-surface-border"
                                    )}
                                >
                                    <span className={cn(
                                        "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform",
                                        isPrivateProfile && "translate-x-5"
                                    )} />
                                </button>
                            </div>
                            <Link href={getPublicProfileHref(user.id)} className="text-xs font-bold text-brand-400 hover:text-brand-300">
                                View your public profile →
                            </Link>
                        </div>

                        {(user.role === "FREE" || user.role === "GENERAL_PREMIUM") && (
                            <div className="p-5 rounded-2xl bg-surface-muted/40 border border-surface-border space-y-3">
                                <p className="text-sm font-bold text-fg">Redeem access code</p>
                                <p className="text-xs text-fg-muted">
                                    {user.role === "GENERAL_PREMIUM"
                                        ? "Have a coach invite? Redeem it here to link with your coach — your training history stays intact."
                                        : "Enter a coach invite or General Premium code to unlock full training features."}
                                </p>
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

                    </div>
                )}

                {/* ─── Goals ─── */}
                {activeSection === "goals" && (
                    <div className="card p-8 space-y-8 animate-slide-up bg-gradient-to-br from-surface-card to-brand-950/5">
                        <div className="flex items-center justify-between gap-3 pb-2 border-b border-surface-border">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-brand-400/10 flex items-center justify-center shrink-0">
                                    <Target className="w-5 h-5 text-brand-400" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-black text-fg tracking-tight">My Goals</h3>
                                    <p className="text-xs text-fg-muted">Changes save automatically</p>
                                </div>
                            </div>
                            {(goalSaving || goalSaved) && (
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-widest shrink-0",
                                    goalSaving ? "text-fg-muted" : "text-success"
                                )}>
                                    {goalSaving ? "Saving…" : "Saved"}
                                </span>
                            )}
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

                    </div>
                )}

                {activeSection === "notifications" && (
                    <div className="card p-6 space-y-6 animate-slide-up">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="heading-3">Activity Notifications</h3>
                                <p className="text-sm text-fg-muted mt-1">
                                    Choose which in-app alerts you receive. Changes save automatically.
                                </p>
                            </div>
                            {(notifSaving || notifSaved) && (
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-widest shrink-0 pt-1",
                                    notifSaving ? "text-fg-muted" : "text-success"
                                )}>
                                    {notifSaving ? "Saving…" : "Saved"}
                                </span>
                            )}
                        </div>

                        {showCoachNotifications && (
                            <div className="space-y-3">
                                <p className="text-xs font-black uppercase tracking-widest text-fg-subtle">Coach alerts</p>
                                <NotificationToggle
                                    label="Client sends a direct message"
                                    description="When a client messages you in chat."
                                    checked={notifyOnClientMessage}
                                    onChange={setNotifyOnClientMessage}
                                />
                                <NotificationToggle
                                    label="Client completes a workout"
                                    description="When a client finishes a logged session."
                                    checked={notifyOnWorkout}
                                    onChange={setNotifyOnWorkout}
                                />
                                <NotificationToggle
                                    label="Client submits a check-in"
                                    description="When a client sends a weekly check-in."
                                    checked={notifyOnCheckIn}
                                    onChange={setNotifyOnCheckIn}
                                />
                                <NotificationToggle
                                    label="Client logs bodyweight"
                                    description="When a client records their weight on the dashboard."
                                    checked={notifyOnMetricUpdate}
                                    onChange={setNotifyOnMetricUpdate}
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

                    </div>
                )}

                {activeSection === "appearance" && (
                    <div className="card p-8 space-y-8 animate-slide-up">
                        <div>
                            <h3 className="text-xl font-bold text-fg mb-1">Theme Presets</h3>
                            <p className="text-sm text-fg-muted">Choose a visual style that matches your energy levels.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { id: "midnight", name: "Midnight Glow", bg: "bg-[#6366f1]" },
                                { id: "emerald", name: "Electric Emerald", bg: "bg-[#10b981]" },
                                { id: "solar", name: "Solar Flare", bg: "bg-[#f59e0b]" },
                                { id: "ocean", name: "Ocean Breeze", bg: "bg-[#06b6d4]" },
                                { id: "rose", name: "Crimson Peak", bg: "bg-[#f43f5e]" },
                            ].map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => setTheme(t.id)}
                                    className={cn(
                                        "p-4 rounded-2xl border transition-all text-left flex items-center gap-4 group hover:border-brand-500/50",
                                        theme === t.id ? "bg-brand-500/10 border-brand-500 shadow-glow-sm" : "bg-surface-muted/50 border-surface-border"
                                    )}
                                >
                                    <div className={cn("w-10 h-10 rounded-xl shrink-0 shadow-sm transition-transform group-hover:scale-105", t.bg)} />
                                    <div className="flex flex-1 items-center justify-between gap-2">
                                        <p className="text-sm font-bold text-fg">{t.name}</p>
                                        {theme === t.id && <Check className="w-4 h-4 text-brand-400 shrink-0" />}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                    </div>
                </div>
            )}
        </div>
        {cropState && (
            <ImageCropModal
                open
                imageSrc={cropState.imageSrc}
                aspect={cropState.target === "avatar" ? 1 : 3}
                cropShape={cropState.target === "avatar" ? "round" : "rect"}
                title={cropState.target === "avatar" ? "Profile photo" : "Profile banner"}
                fileName={cropState.fileName}
                maxOutputWidth={cropState.target === "avatar" ? 512 : 1600}
                onClose={closeCropModal}
                onConfirm={handleCropConfirm}
                confirming={cropState.target === "avatar" ? uploading : bannerUploading}
            />
        )}
        </>
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
