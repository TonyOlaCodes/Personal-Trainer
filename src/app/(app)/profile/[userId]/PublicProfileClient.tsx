"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Flame, Trophy, MessageSquare, Copy, Loader2, Lock, Dumbbell, ChevronRight,
    Target, Calendar, Scale, Activity, Star, ExternalLink, Instagram,
    Globe, Youtube,
} from "lucide-react";
import { cn, getInitials, roleLabels, getRoleNameClass, formatRelative } from "@/lib/utils";
import { resolveUploadUrl } from "@/lib/uploadUrls";
import type { SocialLinks } from "@/lib/profilePrivacy";

interface PublicPlan {
    id: string;
    name: string;
    description?: string | null;
    tags: string[];
    weekCount: number;
    createdAt: string;
}

interface PublicAchievement {
    id: string;
    title: string;
    description: string;
}

interface PublicProfilePersonalRecord {
    exerciseName: string;
    weightKg: number;
    reps: number;
    loggedAt: string;
}

interface PublicProfileActivityItem {
    id: string;
    label: string;
    loggedAt: string;
}

interface PublicProfileProgressPhoto {
    id: string;
    url: string;
    loggedAt: string;
}

interface PublicProfileCoach {
    id: string;
    name: string;
    avatarUrl?: string | null;
    label: string;
}

interface ProfilePayload {
    id: string;
    name: string;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    role: string;
    bio?: string | null;
    experienceLevel?: string | null;
    isPrivateProfile?: boolean;
    joinDate: string;
    trainingGoal: string | null;
    streak: number | null;
    totalWorkouts: number | null;
    bodyweightKg: number | null;
    onlineStatus: { level: string; label: string } | null;
    mutualCoach: PublicProfileCoach | null;
    personalRecords: PublicProfilePersonalRecord[];
    favoriteExercises: string[];
    achievements: PublicAchievement[];
    plans: PublicPlan[];
    activityFeed: PublicProfileActivityItem[];
    progressPhotos: PublicProfileProgressPhoto[];
    socialLinks: SocialLinks | null;
}

interface ViewerPayload {
    isSelf: boolean;
    isAdmin: boolean;
    isAssignedCoach: boolean;
    canMessage: boolean;
    canCopyPlans: boolean;
}

const EXP_LABELS: Record<string, string> = {
    BEGINNER: "Beginner",
    INTERMEDIATE: "Intermediate",
    ADVANCED: "Advanced",
};

interface Props {
    userId: string;
    currentUserId: string;
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
    if (key === "twitter") return `https://x.com/${trimmed.replace(/^@/, "")}`;
    if (key === "youtube") return trimmed.startsWith("@")
        ? `https://youtube.com/${trimmed}`
        : `https://youtube.com/@${trimmed.replace(/^@/, "")}`;
    return `https://${trimmed.replace(/^\/\//, "")}`;
}

export function PublicProfileClient({ userId }: Props) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [profile, setProfile] = useState<ProfilePayload | null>(null);
    const [viewer, setViewer] = useState<ViewerPayload | null>(null);
    const [copyingPlanId, setCopyingPlanId] = useState<string | null>(null);

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

    const copyPlan = async (planId: string) => {
        setCopyingPlanId(planId);
        try {
            const res = await fetch(`/api/plans/${planId}/copy`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error ?? "Could not copy plan");
                return;
            }
            router.push(data.route ?? "/plans");
        } catch {
            alert("Connection error");
        } finally {
            setCopyingPlanId(null);
        }
    };

    const hasStats = useMemo(() => {
        if (!profile) return false;
        return (
            (profile.streak != null && profile.streak > 0) ||
            (profile.totalWorkouts != null && profile.totalWorkouts > 0) ||
            profile.bodyweightKg != null
        );
    }, [profile]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            </div>
        );
    }

    if (error || !profile || !viewer) {
        const isPrivate = error === "This profile is private";
        const notFound = error === "User not found";
        return (
            <div className="card p-10 text-center max-w-lg mx-auto">
                <Lock className="w-10 h-10 text-fg-subtle mx-auto mb-4" />
                <h2 className="text-xl font-black text-fg mb-2">
                    {isPrivate ? "Private profile" : notFound ? "Profile not found" : "Profile unavailable"}
                </h2>
                <p className="text-sm text-fg-muted">
                    {isPrivate
                        ? "This athlete has chosen to keep their profile private."
                        : notFound
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

    const secondarySections: Array<{ key: string; node: React.ReactNode }> = [];

    if (profile.personalRecords.length > 0) {
        secondarySections.push({
            key: "prs",
            node: (
                <SectionCard title="Personal records" icon={Trophy}>
                    <div className="grid gap-2">
                        {profile.personalRecords.map((pr) => (
                            <div
                                key={`${pr.exerciseName}-${pr.loggedAt}`}
                                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-muted/40 border border-surface-border"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-fg truncate">{pr.exerciseName}</p>
                                    <p className="text-[10px] text-fg-muted mt-0.5">{formatRelative(pr.loggedAt)}</p>
                                </div>
                                <p className="text-sm font-black text-brand-300 shrink-0">
                                    {pr.weightKg} kg × {pr.reps}
                                </p>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            ),
        });
    }

    if (profile.favoriteExercises.length > 0) {
        secondarySections.push({
            key: "favorites",
            node: (
                <SectionCard title="Favourite exercises" icon={Star}>
                    <div className="flex flex-wrap gap-2">
                        {profile.favoriteExercises.map((ex) => (
                            <span
                                key={ex}
                                className="px-3 py-1.5 rounded-full bg-brand-400/10 border border-brand-400/20 text-xs font-bold text-brand-300"
                            >
                                {ex}
                            </span>
                        ))}
                    </div>
                </SectionCard>
            ),
        });
    }

    if (profile.plans.length > 0) {
        secondarySections.push({
            key: "plans",
            node: (
                <SectionCard title="Workout plans" icon={Dumbbell}>
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
                                    </p>
                                </div>
                                {viewer.canCopyPlans && (
                                    <button
                                        type="button"
                                        onClick={() => copyPlan(plan.id)}
                                        disabled={copyingPlanId === plan.id}
                                        className="btn-secondary w-full sm:w-auto inline-flex items-center justify-center gap-2"
                                    >
                                        {copyingPlanId === plan.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Copy className="w-4 h-4" />
                                        )}
                                        Copy plan
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </SectionCard>
            ),
        });
    }

    if (profile.achievements.length > 0) {
        secondarySections.push({
            key: "achievements",
            node: (
                <SectionCard title="Achievements" icon={Trophy}>
                    <div className="space-y-2">
                        {profile.achievements.map((achievement) => (
                            <div key={achievement.id} className="p-3 rounded-xl bg-surface-muted/40 border border-surface-border">
                                <p className="text-sm font-black text-fg">{achievement.title}</p>
                                <p className="text-xs text-fg-muted mt-0.5">{achievement.description}</p>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            ),
        });
    }

    if (profile.activityFeed.length > 0) {
        secondarySections.push({
            key: "activity",
            node: (
                <SectionCard title="Recent activity" icon={Activity}>
                    <div className="space-y-2">
                        {profile.activityFeed.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-muted/30 border border-surface-border">
                                <p className="text-sm font-bold text-fg truncate">{item.label}</p>
                                <p className="text-[10px] font-bold text-fg-subtle shrink-0">{formatRelative(item.loggedAt)}</p>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            ),
        });
    }

    if (profile.progressPhotos.length > 0) {
        secondarySections.push({
            key: "photos",
            node: (
                <SectionCard title="Progress photos" icon={ImageIconFallback}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {profile.progressPhotos.map((photo) => (
                            <div key={photo.id} className="aspect-[3/4] rounded-xl overflow-hidden border border-surface-border bg-surface-muted">
                                <img
                                    src={resolveUploadUrl(photo.url)}
                                    alt="Progress"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ))}
                    </div>
                </SectionCard>
            ),
        });
    }

    const socialEntries = profile.socialLinks
        ? (Object.entries(profile.socialLinks) as Array<[keyof SocialLinks, string]>)
            .filter(([, value]) => value?.trim())
        : [];

    return (
        <div className="space-y-5 animate-fade-in pb-20 max-w-4xl mx-auto">
            <div className="card overflow-hidden">
                <div className="relative h-32 sm:h-40 bg-gradient-to-br from-brand-500/25 via-surface-muted to-brand-950/40">
                    {profile.bannerUrl && (
                        <img
                            src={resolveUploadUrl(profile.bannerUrl)}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-card via-surface-card/20 to-transparent" />
                </div>

                <div className="px-5 sm:px-8 pb-6 -mt-12 sm:-mt-14 relative">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-brand flex items-center justify-center text-2xl font-black text-white overflow-hidden shrink-0 border-4 border-surface-card shadow-glow-sm mx-auto sm:mx-0">
                            {profile.avatarUrl ? (
                                <img src={resolveUploadUrl(profile.avatarUrl)} alt={profile.name} className="w-full h-full object-cover" />
                            ) : (
                                getInitials(profile.name)
                            )}
                        </div>

                        <div className="flex-1 min-w-0 text-center sm:text-left space-y-2 pb-1">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-2 justify-center sm:justify-start">
                                <h1 className={cn("text-2xl sm:text-3xl font-black tracking-tight", getRoleNameClass(profile.role))}>
                                    {profile.name}
                                </h1>
                                {profile.onlineStatus && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-muted border border-surface-border text-[10px] font-bold text-fg-muted mx-auto sm:mx-0">
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

                            <p className="text-xs font-black uppercase tracking-widest text-fg-subtle">
                                {roleLabels[profile.role] ?? profile.role}
                                {profile.experienceLevel && ` · ${EXP_LABELS[profile.experienceLevel] ?? profile.experienceLevel}`}
                            </p>

                            <div className="flex flex-wrap gap-2 justify-center sm:justify-start text-[10px] font-bold uppercase tracking-widest text-fg-muted">
                                <span className="inline-flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Joined {profile.joinDate}
                                </span>
                                {profile.trainingGoal && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-400/10 border border-brand-400/20 text-brand-300">
                                        <Target className="w-3 h-3" />
                                        {profile.trainingGoal}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {profile.bio && (
                        <p className="text-sm text-fg-muted leading-relaxed mt-4 max-w-2xl mx-auto sm:mx-0 text-center sm:text-left">
                            {profile.bio}
                        </p>
                    )}

                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start mt-4">
                        {viewer.canMessage && (
                            <Link href={`/chat?with=${profile.id}`} className="btn-primary inline-flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                Message
                            </Link>
                        )}
                        {viewer.isSelf && (
                            <Link href="/settings" className="btn-secondary inline-flex items-center gap-2">
                                Edit profile
                            </Link>
                        )}
                        {profile.isPrivateProfile && (viewer.isSelf || viewer.isAdmin || viewer.isAssignedCoach) && (
                            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-muted border border-surface-border text-xs font-bold text-fg-muted">
                                <Lock className="w-3.5 h-3.5" />
                                Private profile
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {hasStats && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {profile.streak != null && profile.streak > 0 && (
                        <div className="card p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                                <Flame className="w-5 h-5 text-warning" />
                            </div>
                            <div>
                                <p className="text-lg font-black text-fg leading-none">{profile.streak}</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle mt-1">Day streak</p>
                            </div>
                        </div>
                    )}
                    {profile.totalWorkouts != null && profile.totalWorkouts > 0 && (
                        <div className="card p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-brand-400/10 flex items-center justify-center shrink-0">
                                <Dumbbell className="w-5 h-5 text-brand-400" />
                            </div>
                            <div>
                                <p className="text-lg font-black text-fg leading-none">{profile.totalWorkouts}</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle mt-1">Workouts</p>
                            </div>
                        </div>
                    )}
                    {profile.bodyweightKg != null && (
                        <div className="card p-4 flex items-center gap-3 col-span-2 sm:col-span-1">
                            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                                <Scale className="w-5 h-5 text-success" />
                            </div>
                            <div>
                                <p className="text-lg font-black text-fg leading-none">{profile.bodyweightKg} kg</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle mt-1">Bodyweight</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {profile.mutualCoach && (
                <Link
                    href={`/profile/${profile.mutualCoach.id}`}
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

            {secondarySections.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {secondarySections.map((section) => (
                        <div key={section.key}>{section.node}</div>
                    ))}
                </div>
            )}

            {socialEntries.length > 0 && (
                <SectionCard title="Social" icon={Globe}>
                    <div className="flex flex-wrap gap-2">
                        {socialEntries.map(([key, value]) => {
                            const href = formatSocialHref(key, value);
                            const Icon = key === "instagram" ? Instagram : key === "youtube" ? Youtube : ExternalLink;
                            const label = key === "twitter" ? "X" : key.charAt(0).toUpperCase() + key.slice(1);
                            return (
                                <a
                                    key={key}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-muted/40 border border-surface-border text-xs font-bold text-fg hover:border-brand-400/30 transition-colors"
                                >
                                    <Icon className="w-3.5 h-3.5 text-brand-400" />
                                    {label}
                                </a>
                            );
                        })}
                    </div>
                </SectionCard>
            )}

            {viewer.isSelf && (
                <Link href="/settings" className="card p-4 flex items-center justify-between hover:border-brand-500/30 transition-colors">
                    <div>
                        <p className="text-sm font-black text-fg">Privacy & visibility</p>
                        <p className="text-xs text-fg-muted mt-0.5">Control what others see on your profile</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-fg-subtle" />
                </Link>
            )}
        </div>
    );
}

function ImageIconFallback({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
        </svg>
    );
}
