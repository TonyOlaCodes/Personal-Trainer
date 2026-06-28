"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Flame, Trophy, MessageSquare, Copy, Loader2, Lock, Dumbbell, ChevronRight,
    Target, Calendar, Scale, Activity, Star, ExternalLink, Instagram,
    Globe, Youtube,
} from "lucide-react";
import { cn, getInitials, roleLabels, getRoleNameClass, formatRelative } from "@/lib/utils";
import { resolveUploadUrl } from "@/lib/uploadUrls";
import { getPublicProfileHref } from "@/lib/profileNavigation";
import { StreakBadge } from "@/components/shared/StreakBadge";
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
    username: string;
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
}

function activityIcon(label: string) {
    if (label.includes(" PR")) return Trophy;
    if (label.includes("check-in")) return Scale;
    if (label.includes("Shared")) return Dumbbell;
    if (label.includes("streak")) return Flame;
    return Activity;
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

    const showWorkoutStats =
        (profile.streak != null && profile.streak > 0) ||
        (profile.totalWorkouts != null && profile.totalWorkouts > 0) ||
        profile.bodyweightKg != null;

    const detailSections: Array<{ key: string; node: React.ReactNode }> = [];

    if (profile.personalRecords.length > 0) {
        detailSections.push({
            key: "prs",
            node: (
                <SectionCard title="Personal records" icon={Trophy}>
                    <div className="space-y-2">
                        {profile.personalRecords.map((pr) => (
                            <div
                                key={`${pr.exerciseName}-${pr.loggedAt}`}
                                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-muted/40 border border-surface-border"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-fg truncate">{pr.exerciseName}</p>
                                    <p className="text-[10px] text-fg-muted mt-0.5">{formatRelative(pr.loggedAt)}</p>
                                </div>
                                <p className="text-sm font-black text-brand-300 shrink-0 tabular-nums">
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
        detailSections.push({
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
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Link
                                        href={`/plans/create?id=${plan.id}&view=true`}
                                        className="btn-secondary inline-flex items-center justify-center gap-2"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        View plan
                                    </Link>
                                    {viewer.canCopyPlans && (
                                        <button
                                            type="button"
                                            onClick={() => copyPlan(plan.id)}
                                            disabled={copyingPlanId === plan.id}
                                            className="btn-primary inline-flex items-center justify-center gap-2"
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
                            </div>
                        ))}
                    </div>
                </SectionCard>
            ),
        });
    }

    if (profile.achievements.length > 0) {
        detailSections.push({
            key: "achievements",
            node: (
                <SectionCard title="Achievements" icon={AwardIcon}>
                    <div className="flex flex-wrap gap-2">
                        {profile.achievements.map((achievement) => (
                            <span
                                key={achievement.id}
                                title={achievement.description}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/25 text-xs font-bold text-fg"
                            >
                                <Trophy className="w-3.5 h-3.5 text-warning shrink-0" />
                                {achievement.title}
                            </span>
                        ))}
                    </div>
                </SectionCard>
            ),
        });
    }

    if (profile.progressPhotos.length > 0) {
        detailSections.push({
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
            {/* ── Hero ── */}
            <div className="card overflow-hidden">
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

                <div className="px-5 sm:px-8 pb-6 -mt-11 sm:-mt-12 relative">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-5">
                        <div className="w-[4.5rem] h-[4.5rem] sm:w-20 sm:h-20 rounded-2xl bg-gradient-brand flex items-center justify-center text-xl font-black text-white overflow-hidden shrink-0 border-4 border-surface-card shadow-glow-sm mx-auto sm:mx-0">
                            {profile.avatarUrl ? (
                                <img src={resolveUploadUrl(profile.avatarUrl)} alt={profile.name} className="w-full h-full object-cover" />
                            ) : (
                                getInitials(profile.name)
                            )}
                        </div>

                        <div className="flex-1 min-w-0 text-center sm:text-left space-y-1.5 pb-0.5">
                            <h1 className={cn("text-2xl sm:text-3xl font-black tracking-tight leading-tight", getRoleNameClass(profile.role))}>
                                {profile.name}
                            </h1>
                            <p className="text-sm font-bold text-fg-subtle">@{profile.username}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">
                                {roleLabels[profile.role] ?? profile.role}
                                {profile.experienceLevel && ` · ${EXP_LABELS[profile.experienceLevel] ?? profile.experienceLevel}`}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center sm:justify-start mt-4 text-[10px] font-bold uppercase tracking-widest text-fg-muted">
                        <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Joined {profile.joinDate}
                        </span>
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

                    {profile.trainingGoal && (
                        <div className="mt-3 flex justify-center sm:justify-start">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-400/10 border border-brand-400/20 text-[10px] font-bold uppercase tracking-widest text-brand-300">
                                <Target className="w-3 h-3" />
                                {profile.trainingGoal}
                            </span>
                        </div>
                    )}

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

            {/* ── Workout stats ── */}
            {showWorkoutStats && (
                <div className="flex flex-wrap gap-3">
                    {profile.streak != null && profile.streak > 0 && (
                        <div className="card p-4 flex items-center gap-3 flex-1 min-w-[140px]">
                            <StreakBadge streak={profile.streak} size="md" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle">Day streak</p>
                        </div>
                    )}
                    {profile.totalWorkouts != null && profile.totalWorkouts > 0 && (
                        <div className="card p-4 flex items-center gap-3 flex-1 min-w-[140px]">
                            <div className="w-10 h-10 rounded-xl bg-brand-400/10 flex items-center justify-center shrink-0">
                                <Dumbbell className="w-5 h-5 text-brand-400" />
                            </div>
                            <div>
                                <p className="text-xl font-black text-fg leading-none tabular-nums">{profile.totalWorkouts}</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle mt-1">Workouts completed</p>
                            </div>
                        </div>
                    )}
                    {profile.bodyweightKg != null && (
                        <div className="card p-4 flex items-center gap-3 flex-1 min-w-[140px]">
                            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                                <Scale className="w-5 h-5 text-success" />
                            </div>
                            <div>
                                <p className="text-xl font-black text-fg leading-none tabular-nums">{profile.bodyweightKg} kg</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle mt-1">Bodyweight</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Recent activity (prominent) ── */}
            {profile.activityFeed.length > 0 && (
                <SectionCard title="Recent activity" icon={Activity}>
                    <ul className="divide-y divide-surface-border">
                        {profile.activityFeed.map((item) => {
                            const Icon = activityIcon(item.label);
                            return (
                                <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                                    <div className="w-8 h-8 rounded-xl bg-surface-muted border border-surface-border flex items-center justify-center shrink-0">
                                        <Icon className="w-4 h-4 text-brand-400" />
                                    </div>
                                    <p className="text-sm font-medium text-fg flex-1 min-w-0">{item.label}</p>
                                    <p className="text-[10px] font-bold text-fg-subtle shrink-0">{formatRelative(item.loggedAt)}</p>
                                </li>
                            );
                        })}
                    </ul>
                </SectionCard>
            )}

            {profile.mutualCoach && (
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

            {detailSections.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {detailSections.map((section) => (
                        <div key={section.key} className={section.key === "plans" ? "lg:col-span-2" : undefined}>
                            {section.node}
                        </div>
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

function AwardIcon({ className }: { className?: string }) {
    return <Trophy className={className} />;
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
