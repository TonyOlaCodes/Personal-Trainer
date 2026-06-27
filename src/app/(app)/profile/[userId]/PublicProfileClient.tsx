"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Flame, Trophy, MessageSquare, Copy, Loader2, Lock, Dumbbell, ChevronRight,
} from "lucide-react";
import { cn, getInitials, roleLabels, getRoleNameClass } from "@/lib/utils";
import { resolveUploadUrl } from "@/lib/uploadUrls";

interface PublicPlan {
    id: string;
    name: string;
    description?: string | null;
    tags: string[];
    isPublic?: boolean;
    weekCount: number;
    createdAt: string;
}

interface PublicAchievement {
    id: string;
    title: string;
    description: string;
}

interface ProfilePayload {
    id: string;
    name: string;
    avatarUrl?: string | null;
    role: string;
    bio?: string | null;
    experienceLevel?: string | null;
    isPrivateProfile?: boolean;
    streak: number;
    achievements: PublicAchievement[];
    plans: PublicPlan[];
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

export function PublicProfileClient({ userId, currentUserId }: Props) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [profile, setProfile] = useState<ProfilePayload | null>(null);
    const [viewer, setViewer] = useState<ViewerPayload | null>(null);
    const [copyingPlanId, setCopyingPlanId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/users/${userId}/profile`);
                const data = await res.json();
                if (!res.ok) {
                    if (!cancelled) setError(data.error ?? "Could not load profile");
                    return;
                }
                if (!cancelled) {
                    setProfile(data.profile);
                    setViewer(data.viewer);
                }
            } catch {
                if (!cancelled) setError("Connection error");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

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
        return (
            <div className="card p-10 text-center max-w-lg mx-auto">
                <Lock className="w-10 h-10 text-fg-subtle mx-auto mb-4" />
                <h2 className="text-xl font-black text-fg mb-2">Profile unavailable</h2>
                <p className="text-sm text-fg-muted">{error ?? "This profile could not be loaded."}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="card p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-brand flex items-center justify-center text-2xl font-black text-white overflow-hidden shrink-0 mx-auto sm:mx-0">
                        {profile.avatarUrl ? (
                            <img src={resolveUploadUrl(profile.avatarUrl)} alt={profile.name} className="w-full h-full object-cover" />
                        ) : (
                            getInitials(profile.name)
                        )}
                    </div>

                    <div className="flex-1 min-w-0 text-center sm:text-left space-y-3">
                        <div>
                            <h1 className={cn("text-3xl font-black tracking-tight", getRoleNameClass(profile.role))}>
                                {profile.name}
                            </h1>
                            <p className="text-xs font-black uppercase tracking-widest text-fg-subtle mt-1">
                                {roleLabels[profile.role] ?? profile.role}
                                {profile.experienceLevel && ` · ${EXP_LABELS[profile.experienceLevel] ?? profile.experienceLevel}`}
                            </p>
                        </div>

                        {profile.bio && (
                            <p className="text-sm text-fg-muted leading-relaxed max-w-2xl">{profile.bio}</p>
                        )}

                        <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-warning/10 border border-warning/20">
                                <Flame className="w-4 h-4 text-warning" />
                                <span className="text-sm font-black text-fg">{profile.streak} day streak</span>
                            </div>
                            {profile.isPrivateProfile && (viewer.isSelf || viewer.isAdmin || viewer.isAssignedCoach) && (
                                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-muted border border-surface-border">
                                    <Lock className="w-4 h-4 text-fg-subtle" />
                                    <span className="text-xs font-bold text-fg-muted">Private profile</span>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1">
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
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card p-6 space-y-4">
                    <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-brand-400" />
                        <h2 className="text-lg font-black text-fg">Public achievements</h2>
                    </div>
                    {profile.achievements.length === 0 ? (
                        <p className="text-sm text-fg-muted">No public achievements yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {profile.achievements.map((achievement) => (
                                <div key={achievement.id} className="p-4 rounded-2xl bg-surface-muted/40 border border-surface-border">
                                    <p className="text-sm font-black text-fg">{achievement.title}</p>
                                    <p className="text-xs text-fg-muted mt-0.5">{achievement.description}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card p-6 space-y-4">
                    <div className="flex items-center gap-2">
                        <Dumbbell className="w-5 h-5 text-brand-400" />
                        <h2 className="text-lg font-black text-fg">Public workout plans</h2>
                    </div>
                    {profile.plans.length === 0 ? (
                        <p className="text-sm text-fg-muted">No public plans shared yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {profile.plans.map((plan) => (
                                <div key={plan.id} className="p-4 rounded-2xl bg-surface-muted/40 border border-surface-border space-y-3">
                                    <div>
                                        <p className="text-sm font-black text-fg">{plan.name}</p>
                                        {plan.description && (
                                            <p className="text-xs text-fg-muted mt-1">{plan.description}</p>
                                        )}
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle mt-2">
                                            {plan.weekCount} week{plan.weekCount === 1 ? "" : "s"}
                                            {plan.isPublic === false && (viewer.isSelf || viewer.isAdmin || viewer.isAssignedCoach) && " · Private"}
                                        </p>
                                    </div>
                                    {viewer.canCopyPlans && (plan.isPublic !== false || viewer.isAdmin || viewer.isAssignedCoach) && (
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
                                            Copy to my plans
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {viewer.isSelf && (
                <Link href="/settings" className="card p-4 flex items-center justify-between hover:border-brand-500/30 transition-colors">
                    <div>
                        <p className="text-sm font-black text-fg">Privacy & plan visibility</p>
                        <p className="text-xs text-fg-muted mt-0.5">Manage private profile and public plans in Settings</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-fg-subtle" />
                </Link>
            )}
        </div>
    );
}
