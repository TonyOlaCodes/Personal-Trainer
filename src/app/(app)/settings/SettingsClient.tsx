"use client";

import { useState, useRef } from "react";
import {
    User, Bell, Shield, CreditCard,
    HelpCircle, LogOut, ChevronRight, Check,
    Camera, Loader2, Save, Heart, Copy
} from "lucide-react";
import { UserButton, useClerk } from "@clerk/nextjs";
import { cn, getInitials } from "@/lib/utils";

interface Props {
    user: {
        name?: string | null;
        email: string;
        role: string;
        onboardingDone: boolean;
        avatarUrl?: string | null;
    };
}

export function SettingsClient({ user }: Props) {
    const { signOut } = useClerk();
    const [activeTab, setActiveTab] = useState("profile");
    
    // Form states
    const [name, setName] = useState(user.name || "");
    const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const sections = [
        { id: "profile", label: "Profile", icon: User },
        { id: "notifications", label: "Notifications", icon: Bell },
        { id: "security", label: "Security", icon: Shield },
        { id: "billing", label: "Billing", icon: CreditCard },
        { id: "contribute", label: "Contribute", icon: Heart },
    ];

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
                // Success feedback - could reload or show toast
                alert("Profile Updated Successfully!");
                window.location.reload(); 
            } else {
                const data = await res.json();
                alert(data.error || "Update failed");
            }
        } catch (err) {
            alert("Connection error.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 flex flex-col md:flex-row gap-8 animate-fade-in pb-20">
            {/* Sidebar Tabs */}
            <div className="w-full md:w-64 space-y-2">
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
                                <label className="text-[10px] font-black text-fg-subtle uppercase tracking-widest px-1">Display Nomenclature</label>
                                <input 
                                    type="text" 
                                    className="input h-12 text-sm font-bold" 
                                    placeholder="e.g. Tony Olajide" 
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-fg-subtle uppercase tracking-widest px-1">Verified Email</label>
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
                                {saving ? "Synchronizing..." : "Save Changes"}
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

                {activeTab === "contribute" && (
                    <div className="card p-8 space-y-8 animate-slide-up bg-gradient-to-br from-surface-card to-brand-950/10 border-brand-500/20">
                        <div className="text-center space-y-3">
                            <div className="w-16 h-16 bg-brand-400/10 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-glow-brand-sm">
                                <Heart className="w-8 h-8 text-brand-400 fill-brand-400/20" />
                            </div>
                            <h3 className="text-2xl font-black text-fg tracking-tight">Support the Protocol</h3>
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
