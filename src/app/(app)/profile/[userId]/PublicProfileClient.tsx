"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
    Trophy, MessageSquare, Loader2, Lock, Dumbbell, ChevronRight,
    Calendar, Activity, ExternalLink, Instagram,
    Youtube, Users, Flame, Pencil,
} from "lucide-react";
import { cn, getInitials, roleLabels, getRoleNameClass, formatDate } from "@/lib/utils";
import { resolveUploadUrl } from "@/lib/uploadUrls";
import { getPublicProfileHref } from "@/lib/profileNavigation";
import { AchievementsList } from "@/components/shared/AchievementsPanel";
import { AchievementsModal } from "@/components/shared/AchievementsModal";
import type { AchievementDisplayItem } from "@/lib/achievements";
import type { SocialLinks } from "@/lib/profilePrivacy";

interface PublicPlan {
    id: string;
    name: string;
    description?: string | null;
    tags: string[];
    weekCount: number;
    createdAt: string;
    creatorName: string;
}

interface PublicAchievementSummary {
    totalUnlocked: number;
    totalAchievements: number;
    preview: AchievementDisplayItem[];
}

interface PublicProfilePersonalRecord {
    exerciseName: string;
    weightKg: number;
    reps: number;
    loggedAt: string;
    workoutLogId?: string | null;
    isPr?: boolean;
}

interface PublicProfileActivityItem {
    id: string;
    workoutLogId: string;
    workoutName: string;
    loggedAt: string;
    exerciseCount?: number;
    setCount?: number;
}

interface PublicProfileCoach {
    id: string;
    name: string;
    avatarUrl?: string | null;
    label: string;
}

interface PublicProfileCoachedBy {
    id: string;
    name: string;
    avatarUrl?: string | null;
}

interface PublicProfileCoachClient {
    id: string;
    name: string;
    avatarUrl?: string | null;
}

interface ProfilePayload {
    id: string;
    name: string;
    chosenName: string;
    username: string;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    role: string;
    bio?: string | null;
    experienceLevel?: string | null;
    isPrivateProfile?: boolean;
    joinDate: string;
    trainingGoal: string | null;
    goal: string | null;
    trainingLocation: string | null;
    trainingDaysPerWeek: number | null;
    streak: number | null;
    totalWorkouts: number | null;
    totalPrs?: number | null;
    onlineStatus: { level: string; label: string } | null;
    mutualCoach: PublicProfileCoach | null;
    coachedBy: PublicProfileCoachedBy | null;
    personalRecords: PublicProfilePersonalRecord[];
    achievementSummary: PublicAchievementSummary;
    plans: PublicPlan[];
    activityFeed: PublicProfileActivityItem[];
    activityTotal?: number;
    socialLinks: SocialLinks | null;
    coachClients: PublicProfileCoachClient[];
}

interface ViewerPayload {
    isSelf: boolean;
    isAdmin: boolean;
    isAssignedCoach: boolean;
    isLimitedView: boolean;
    canMessage: boolean;
    canCopyPlans: boolean;
    canSetNickname?: boolean;
    nickname?: string | null;
}

interface Props {
    userId: string;
}

function SectionCard({
    title,
    icon: Icon,
    children,
    className,
}: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("card p-5 sm:p-6 space-y-4", className)}>
            <div className="flex items-center gap-2">
                <Icon className="w-5 h-5 text-brand-400 shrink-0" />
                <h2 className="text-base sm:text-lg font-black text-fg">{title}</h2>
            </div>
            {children}
        </div>
    );
}

function formatSocialHref(key: keyof SocialLinks, value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    if (key === "instagram") return `https://instagram.com/${trimmed.replace(/^@/, "")}`;
    if (key === "tiktok") return `https://tiktok.com/@${trimmed.replace(/^@/, "")}`;
    if (key === "youtube") return trimmed.startsWith("@")
        ? `https://youtube.com/${trimmed}`
        : `https://youtube.com/@${trimmed.replace(/^@/, "")}`;
    return `https://${trimmed.replace(/^\/\//, "")}`;
}

export function PublicProfileClient({ userId }: Props) {
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [profile, setProfile] = useState<ProfilePayload | null>(null);
    const [viewer, setViewer] = useState<ViewerPayload | null>(null);
    const [showAchievements, setShowAchievements] = useState(false);
    const [allAchievements, setAllAchievements] = useState<AchievementDisplayItem[] | null>(null);
    const [achievementsLoading, setAchievementsLoading] = useState(false);
    const [nicknameDraft, setNicknameDraft] = useState("");
    const [nicknameSaving, setNicknameSaving] = useState(false);
    const [nicknameMessage, setNicknameMessage] = useState<string | null>(null);
    const [editingNickname, setEditingNickname] = useState(false);
    const [showAllActivity, setShowAllActivity] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let attempt = 0;
        const maxAttempts = 3;

        const loadProfile = async () => {
            setLoading(true);
            if (attempt === 0) setError(null);
            try {
                const res = await fetch(`/api/users/${userId}/profile`);
                const data = await res.json();
                if (!res.ok) {
                    if (res.status >= 500 && attempt < maxAttempts - 1) {
                        attempt += 1;
                        await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
                        if (!cancelled) void loadProfile();
                        return;
                    }
                    if (!cancelled) setError(data.error ?? "Could not load profile");
                    return;
                }
                if (!cancelled) {
                    setProfile(data.profile);
                    setViewer(data.viewer);
                    setNicknameDraft(data.viewer?.nickname ?? "");
                    setError(null);
                }
            } catch {
                if (attempt < maxAttempts - 1) {
                    attempt += 1;
                    await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
                    if (!cancelled) void loadProfile();
                    return;
                }
                if (!cancelled) setError("Connection error");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void loadProfile();
        return () => { cancelled = true; };
    }, [userId]);

    const openAchievements = useCallback(async () => {
        setShowAchievements(true);
        if (allAchievements) return;

        setAchievementsLoading(true);
        try {
            const res = await fetch(`/api/users/${userId}/achievements`);
            const data = await res.json();
            if (res.ok) {
                setAllAchievements(data.achievements);
            }
        } catch {
            // Modal still shows preview from profile
        } finally {
            setAchievementsLoading(false);
        }
    }, [allAchievements, userId]);

    useEffect(() => {
        if (searchParams.get("achievements") === "1") {
            void openAchievements();
        }
    }, [searchParams, openAchievements]);

    const saveNickname = useCallback(async () => {
        if (!viewer || viewer.isSelf) return;
        setNicknameSaving(true);
        setNicknameMessage(null);
        try {
            const res = await fetch(`/api/users/${userId}/nickname`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nickname: nicknameDraft.trim() || null }),
            });
            const data = await res.json();
            if (!res.ok) {
                setNicknameMessage(data.error ?? "Could not save nickname");
                return;
            }
            setProfile((current) => current
                ? { ...current, name: data.displayName, chosenName: data.chosenName ?? current.chosenName }
                : current);
            setViewer((current) => current
                ? { ...current, nickname: data.nickname ?? null }
                : current);
            setNicknameDraft(data.nickname ?? "");
            setNicknameMessage(null);
            setEditingNickname(false);
        } catch {
            setNicknameMessage("Connection error");
        } finally {
            setNicknameSaving(false);
        }
    }, [nicknameDraft, userId, viewer]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            </div>
        );
    }

    if (error || !profile || !viewer) {
        const notFound = error === "User not found";
        return (
            <div className="card p-10 text-center max-w-lg mx-auto">
                <Lock className="w-10 h-10 text-fg-subtle mx-auto mb-4" />
                <h2 className="text-xl font-black text-fg mb-2">
                    {notFound ? "Profile not found" : "Profile unavailable"}
                </h2>
                <p className="text-sm text-fg-muted">
                    {notFound
                        ? "This user may have been removed or the link is invalid."
                        : (error ?? "This profile could not be loaded.")}
                </p>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="btn-secondary mt-4 text-xs h-10 px-4"
                >
                    Try again
                </button>
            </div>
        );
    }

    const isLimited = viewer.isLimitedView;
    const isCoachProfile = profile.role === "COACH" || profile.role === "SUPER_ADMIN";
    const totalPrs = profile.totalPrs ?? null;
    const activityTotal = profile.activityTotal ?? profile.activityFeed.length;
    const visibleActivity = showAllActivity
        ? profile.activityFeed
        : profile.activityFeed.slice(0, 3);

    const trainingStatItems: Array<{
        key: string;
        value: string;
        label: string;
        icon: React.ComponentType<{ className?: string }>;
        accent: string;
    }> = [];
    if (!isLimited) {
        if (profile.streak != null && profile.streak > 0) {
            trainingStatItems.push({
                key: "streak",
                value: String(profile.streak),
                label: "Current Streak",
                icon: Flame,
                accent: "text-warning",
            });
        }
        if (profile.totalWorkouts != null && profile.totalWorkouts > 0) {
            trainingStatItems.push({
                key: "workouts",
                value: String(profile.totalWorkouts),
                label: "Workouts Completed",
                icon: Dumbbell,
                accent: "text-brand-400",
            });
        }
        if (totalPrs != null && totalPrs > 0) {
            trainingStatItems.push({
                key: "prs",
                value: String(totalPrs),
                label: "Personal Records",
                icon: Trophy,
                accent: "text-brand-300",
            });
        }
        if (profile.trainingDaysPerWeek != null && profile.trainingDaysPerWeek > 0) {
            trainingStatItems.push({
                key: "freq",
                value: `${profile.trainingDaysPerWeek}×`,
                label: "Training Frequency",
                icon: Calendar,
                accent: "text-success",
            });
        }
    }

    const socialEntries = profile.socialLinks
        ? (Object.entries(profile.socialLinks) as Array<[keyof SocialLinks, string]>)
            .filter(([, value]) => value?.trim())
        : [];

    const detailSections: Array<{ key: string; node: React.ReactNode }> = [];

    if (!isLimited && profile.plans.length > 0) {
        detailSections.push({
            key: "plans",
            node: (
                <SectionCard title="Workout plans" icon={Dumbbell} className="lg:col-span-2">
                    <div className="space-y-3">
                        {profile.plans.map((plan) => (
                            <div key={plan.id} className="p-4 rounded-2xl bg-surface-muted/40 border border-surface-border space-y-3">
                                <div>
                                    <p className="text-sm font-black text-fg">{plan.name}</p>
                                    {plan.description && (
                                        <p className="text-xs text-fg-muted mt-1 line-clamp-2">{plan.description}</p>
                                    )}
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle mt-2">
                                        {plan.weekCount} week{plan.weekCount === 1 ? "" : "s"}
                                        <span className="normal-case tracking-normal font-medium text-fg-subtle/70 ml-2">
                                            · Creator: {plan.creatorName}
                                        </span>
                                    </p>
                                </div>
                                <Link
                                    href={`/plans/create?id=${plan.id}&view=true`}
                                    className="btn-secondary inline-flex items-center justify-center gap-2"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    View plan
                                </Link>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            ),
        });
    }

    return (
        <div className="space-y-5 animate-fade-in pb-20 max-w-4xl mx-auto">
            {/* ── Hero ── */}
            <div className="card overflow-hidden">
                {!isLimited && (
                    <div className="relative h-28 sm:h-36 bg-gradient-to-br from-brand-500/25 via-surface-muted to-brand-950/40">
                        {profile.bannerUrl && (
                            <img
                                src={resolveUploadUrl(profile.bannerUrl)}
                                alt=""
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-surface-card via-surface-card/30 to-transparent" />
                    </div>
                )}

                <div className={cn("px-5 sm:px-8 pb-6 relative", isLimited ? "pt-8" : "-mt-11 sm:-mt-12")}>
                    {viewer.isSelf && (
                        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 mb-4">
                            <Link
                                href="/settings?section=profile"
                                className={cn(
                                    "inline-flex items-center gap-2 h-9 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-colors",
                                    profile.isPrivateProfile
                                        ? "bg-brand-500/15 border-brand-500/35 text-brand-300 shadow-glow-brand-sm"
                                        : "bg-surface-muted/40 border-surface-border text-fg-muted hover:text-fg hover:border-brand-500/30"
                                )}
                            >
                                <Lock className="w-3.5 h-3.5" />
                                Private account
                            </Link>
                            <Link href="/settings?section=profile" className="btn-secondary inline-flex items-center gap-2 h-9 px-4 text-xs">
                                Edit profile
                            </Link>
                        </div>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-5">
                        <div className="w-[4.5rem] h-[4.5rem] sm:w-20 sm:h-20 rounded-2xl bg-gradient-brand flex items-center justify-center text-xl font-black text-white overflow-hidden shrink-0 border-4 border-surface-card shadow-glow-sm mx-auto sm:mx-0">
                            {profile.avatarUrl ? (
                                <img src={resolveUploadUrl(profile.avatarUrl)} alt={profile.name} className="w-full h-full object-cover" />
                            ) : (
                                getInitials(profile.name)
                            )}
                        </div>

                        <div className="flex-1 min-w-0 text-center sm:text-left space-y-1.5 pb-0.5">
                            <div className="flex items-center justify-center sm:justify-start gap-2">
                                <h1 className={cn("text-2xl sm:text-3xl font-black tracking-tight leading-tight", getRoleNameClass(profile.role))}>
                                    {profile.name}
                                </h1>
                                {!viewer.isSelf && viewer.canSetNickname && !editingNickname && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setNicknameDraft(viewer.nickname ?? "");
                                            setEditingNickname(true);
                                            setNicknameMessage(null);
                                        }}
                                        className="p-1.5 rounded-lg text-fg-subtle hover:text-brand-400 hover:bg-brand-500/10 transition-colors"
                                        title="Set private nickname"
                                        aria-label="Set private nickname"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            <p className="text-sm font-bold text-fg-subtle">@{profile.username}</p>
                            {!viewer.isSelf && viewer.canSetNickname && editingNickname && (
                                <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto sm:mx-0 pt-1">
                                    <input
                                        type="text"
                                        value={nicknameDraft}
                                        onChange={(e) => setNicknameDraft(e.target.value)}
                                        placeholder={profile.chosenName}
                                        maxLength={40}
                                        className="input flex-1 h-9 text-sm"
                                        autoFocus
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => void saveNickname()}
                                            disabled={nicknameSaving}
                                            className="btn-primary h-9 px-3 text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
                                        >
                                            {nicknameSaving ? "…" : "Save"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingNickname(false);
                                                setNicknameDraft(viewer.nickname ?? "");
                                                setNicknameMessage(null);
                                            }}
                                            className="btn-secondary h-9 px-3 text-[10px] font-black uppercase tracking-widest"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                            {nicknameMessage && (
                                <p className="text-xs font-bold text-danger">{nicknameMessage}</p>
                            )}
                            {!isLimited && (
                                <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">
                                    {roleLabels[profile.role] ?? profile.role}
                                </p>
                            )}
                            {!isLimited && profile.coachedBy && (
                                <Link
                                    href={getPublicProfileHref(profile.coachedBy.id)}
                                    className="inline-flex items-center gap-2 mt-1 mx-auto sm:mx-0 px-2.5 py-1.5 rounded-xl bg-surface-muted/50 border border-surface-border hover:border-brand-500/30 transition-colors"
                                >
                                    <div className="w-6 h-6 rounded-lg bg-gradient-brand flex items-center justify-center text-[9px] font-black text-white overflow-hidden shrink-0">
                                        {profile.coachedBy.avatarUrl ? (
                                            <img
                                                src={resolveUploadUrl(profile.coachedBy.avatarUrl)}
                                                alt=""
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            getInitials(profile.coachedBy.name)
                                        )}
                                    </div>
                                    <span className="text-[11px] text-fg-muted">
                                        Coached by{" "}
                                        <span className="font-bold text-fg">{profile.coachedBy.name}</span>
                                    </span>
                                </Link>
                            )}
                            {!isLimited && (
                                profile.goal ||
                                profile.experienceLevel ||
                                profile.trainingLocation ||
                                profile.trainingDaysPerWeek
                            ) && (
                                <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
                                    {profile.goal && (
                                        <span className="badge text-[9px] bg-brand-500/10 text-brand-400 border border-brand-500/20">
                                            {profile.goal.replace(/_/g, " ")}
                                        </span>
                                    )}
                                    {profile.experienceLevel && (
                                        <span className="badge text-[9px] bg-warning-500/10 text-warning border border-warning-500/20">
                                            {profile.experienceLevel.replace(/_/g, " ")}
                                        </span>
                                    )}
                                    {profile.trainingLocation && (
                                        <span className="badge text-[9px] bg-success-500/10 text-success border border-success-500/20">
                                            {profile.trainingLocation} Training
                                        </span>
                                    )}
                                    {profile.trainingDaysPerWeek != null && profile.trainingDaysPerWeek > 0 && (
                                        <span className="badge text-[9px] bg-surface-muted text-fg-muted border border-surface-border">
                                            {profile.trainingDaysPerWeek} Days / Wk
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center sm:justify-start mt-4 text-[10px] font-bold uppercase tracking-widest text-fg-muted">
                        {!isLimited && (
                            <span className="inline-flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Joined {profile.joinDate}
                            </span>
                        )}
                        {profile.onlineStatus && (
                            <span className="inline-flex items-center gap-1.5">
                                <span className={cn(
                                    "w-2 h-2 rounded-full",
                                    profile.onlineStatus.level === "online" && "bg-success shadow-[0_0_6px] shadow-success/60",
                                    profile.onlineStatus.level === "recent" && "bg-warning",
                                    profile.onlineStatus.level === "inactive" && "bg-fg-subtle"
                                )} />
                                {profile.onlineStatus.label}
                            </span>
                        )}
                    </div>

                    {isLimited && (
                        <p className="text-sm text-fg-muted text-center sm:text-left mt-4 leading-relaxed">
                            This account is private. Only basic profile info is visible.
                        </p>
                    )}

                    {!isLimited && (socialEntries.length > 0 || viewer.canMessage) && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                            {socialEntries.map(([key, value]) => {
                                const href = formatSocialHref(key, value);
                                const Icon = key === "instagram" ? Instagram : key === "youtube" ? Youtube : ExternalLink;
                                const label = key === "tiktok" ? "TikTok" : key.charAt(0).toUpperCase() + key.slice(1);
                                return (
                                    <a
                                        key={key}
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-muted/40 border border-surface-border text-[10px] font-bold uppercase tracking-widest text-fg hover:border-brand-400/30 transition-colors"
                                    >
                                        <Icon className="w-3.5 h-3.5 text-brand-400" />
                                        {label}
                                    </a>
                                );
                            })}
                            {viewer.canMessage && (
                                <Link href={`/chat?with=${profile.id}`} className="btn-primary inline-flex items-center gap-2 h-9 px-4 text-xs">
                                    <MessageSquare className="w-4 h-4" />
                                    Message
                                </Link>
                            )}
                        </div>
                    )}

                    {!isLimited && profile.bio && (
                        <p className="text-sm text-fg-muted leading-relaxed mt-4 max-w-2xl mx-auto sm:mx-0 text-center sm:text-left">
                            {profile.bio}
                        </p>
                    )}

                </div>
            </div>

            {!isLimited && trainingStatItems.length > 0 && (
                <SectionCard title="Training Stats" icon={Activity}>
                    <div className="grid grid-cols-2 gap-3">
                        {trainingStatItems.map((stat) => {
                            const Icon = stat.icon;
                            return (
                                <div
                                    key={stat.key}
                                    className="rounded-2xl border border-surface-border bg-surface-muted/25 p-3.5 space-y-1.5"
                                >
                                    <div className="flex items-center gap-2">
                                        <Icon className={cn("w-4 h-4 shrink-0", stat.accent)} />
                                        <p className={cn("text-2xl font-black tabular-nums leading-none", stat.accent)}>
                                            {stat.value}
                                        </p>
                                    </div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle">
                                        {stat.label}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </SectionCard>
            )}

            {!isLimited && profile.personalRecords.length > 0 && (
                <SectionCard title="Favourite Lifts" icon={Dumbbell}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {profile.personalRecords.map((pr) => {
                            const content = (
                                <>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-black text-fg truncate">{pr.exerciseName}</p>
                                        <p className="text-xs font-semibold text-fg-muted mt-0.5 tabular-nums">
                                            {pr.weightKg} kg
                                            {pr.reps > 0 ? ` × ${pr.reps}` : ""}
                                        </p>
                                    </div>
                                    {pr.isPr !== false && (
                                        <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-warning bg-warning/10 border border-warning/25 px-2 py-1 rounded-lg">
                                            PR
                                        </span>
                                    )}
                                </>
                            );
                            const className =
                                "flex items-center gap-3 p-3.5 rounded-2xl bg-surface-muted/30 border border-surface-border hover:border-brand-500/30 transition-colors";
                            return pr.workoutLogId ? (
                                <Link
                                    key={`${pr.exerciseName}-${pr.loggedAt}`}
                                    href={`/plans/log/view/${pr.workoutLogId}`}
                                    className={className}
                                >
                                    {content}
                                </Link>
                            ) : (
                                <div key={`${pr.exerciseName}-${pr.loggedAt}`} className={className}>
                                    {content}
                                </div>
                            );
                        })}
                    </div>
                    {viewer.isSelf && (
                        <Link
                            href="/progress"
                            className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-brand-400 hover:text-brand-300 pt-1"
                        >
                            Manage on Progress
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                    )}
                </SectionCard>
            )}

            {!isLimited && isCoachProfile && profile.coachClients.length > 0 && (
                <SectionCard title="Clients" icon={Users}>
                    <ul className="divide-y divide-surface-border">
                        {profile.coachClients.map((client) => (
                            <li key={client.id}>
                                <Link
                                    href={getPublicProfileHref(client.id)}
                                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:opacity-80 transition-opacity"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center text-xs font-black text-white overflow-hidden shrink-0">
                                        {client.avatarUrl ? (
                                            <img
                                                src={resolveUploadUrl(client.avatarUrl)}
                                                alt={client.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            getInitials(client.name)
                                        )}
                                    </div>
                                    <p className="flex-1 min-w-0 text-sm font-black text-fg truncate">{client.name}</p>
                                    <ChevronRight className="w-4 h-4 text-fg-subtle shrink-0" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </SectionCard>
            )}

            {!isLimited && profile.activityFeed.length > 0 && (
                <SectionCard title="Recent Activity" icon={Activity}>
                    <ul className="divide-y divide-surface-border">
                        {visibleActivity.map((item) => (
                            <li key={item.id}>
                                <Link
                                    href={`/plans/log/view/${item.workoutLogId}`}
                                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:opacity-80 transition-opacity"
                                >
                                    <div className="w-8 h-8 rounded-xl bg-surface-muted border border-surface-border flex items-center justify-center shrink-0">
                                        <Dumbbell className="w-4 h-4 text-brand-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-fg truncate">{item.workoutName}</p>
                                        <p className="text-[10px] font-bold text-fg-subtle mt-0.5">
                                            {formatDate(item.loggedAt)}
                                            {(item.exerciseCount != null && item.exerciseCount > 0) ||
                                            (item.setCount != null && item.setCount > 0) ? (
                                                <>
                                                    {" · "}
                                                    {item.exerciseCount != null && item.exerciseCount > 0
                                                        ? `${item.exerciseCount} exercise${item.exerciseCount === 1 ? "" : "s"}`
                                                        : null}
                                                    {item.exerciseCount != null &&
                                                    item.exerciseCount > 0 &&
                                                    item.setCount != null &&
                                                    item.setCount > 0
                                                        ? " · "
                                                        : null}
                                                    {item.setCount != null && item.setCount > 0
                                                        ? `${item.setCount} set${item.setCount === 1 ? "" : "s"}`
                                                        : null}
                                                </>
                                            ) : null}
                                        </p>
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-success shrink-0">
                                        Done
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-fg-subtle shrink-0" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                    {activityTotal > 3 && (
                        <button
                            type="button"
                            onClick={() => setShowAllActivity((open) => !open)}
                            className="w-full text-center text-[10px] font-black uppercase tracking-widest text-brand-400 hover:text-brand-300 pt-1"
                        >
                            {showAllActivity ? "Show less" : "View all activity"}
                        </button>
                    )}
                </SectionCard>
            )}

            {!isLimited && profile.achievementSummary.totalUnlocked > 0 && (
                <SectionCard title="Achievements" icon={Trophy}>
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="text-sm font-black text-fg tabular-nums">
                            {profile.achievementSummary.totalUnlocked} / {profile.achievementSummary.totalAchievements}
                        </p>
                        <button
                            type="button"
                            onClick={() => void openAchievements()}
                            className="text-[10px] font-black uppercase tracking-widest text-brand-400 hover:text-brand-300 transition-colors"
                        >
                            View all achievements
                        </button>
                    </div>
                    {profile.achievementSummary.preview.length > 0 && (
                        <AchievementsList
                            achievements={profile.achievementSummary.preview.slice(0, 3)}
                            layout="grid"
                        />
                    )}
                </SectionCard>
            )}

            {!isLimited && profile.mutualCoach && (
                <Link
                    href={getPublicProfileHref(profile.mutualCoach.id)}
                    className="card p-4 flex items-center gap-4 hover:border-brand-500/30 transition-colors"
                >
                    <div className="w-12 h-12 rounded-2xl bg-gradient-brand flex items-center justify-center text-sm font-black text-white overflow-hidden shrink-0">
                        {profile.mutualCoach.avatarUrl ? (
                            <img src={resolveUploadUrl(profile.mutualCoach.avatarUrl)} alt={profile.mutualCoach.name} className="w-full h-full object-cover" />
                        ) : (
                            getInitials(profile.mutualCoach.name)
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">{profile.mutualCoach.label}</p>
                        <p className="text-sm font-black text-fg truncate">{profile.mutualCoach.name}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-fg-subtle shrink-0" />
                </Link>
            )}

            {!isLimited && detailSections.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {detailSections.map((section) => (
                        <div key={section.key} className={section.key === "plans" ? "lg:col-span-2" : undefined}>
                            {section.node}
                        </div>
                    ))}
                </div>
            )}

            <AchievementsModal
                open={showAchievements}
                onClose={() => setShowAchievements(false)}
                achievements={allAchievements ?? profile.achievementSummary.preview}
                totalUnlocked={profile.achievementSummary.totalUnlocked}
                totalAchievements={profile.achievementSummary.totalAchievements}
                profileName={profile.name}
                loading={achievementsLoading && !allAchievements}
            />
        </div>
    );
}
