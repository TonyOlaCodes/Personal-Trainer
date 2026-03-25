"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
    Send, Image as ImageIcon, Globe, MessageSquare, Star, X, Pencil, Trash2,
    Check, MoreVertical, Reply, Pin, SmilePlus, CheckCheck, ChevronDown, Search, AtSign
} from "lucide-react";
import { getInitials, formatRelative, cn, roleLabels } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────── */
interface ReplyPreview {
    id: string;
    content?: string | null;
    type: string;
    sender: { id: string; name?: string | null };
}

interface ReactionData {
    id: string;
    emoji: string;
    userId: string;
    user: { id: string; name?: string | null };
}

interface Message {
    id: string;
    content?: string | null;
    mediaUrl?: string | null;
    type: string;
    isGeneral: boolean;
    isPinned: boolean;
    status: "SENT" | "DELIVERED" | "SEEN";
    mentions: string[];
    createdAt: string;
    updatedAt?: string | null;
    replyTo?: ReplyPreview | null;
    reactions: ReactionData[];
    sender: { id: string; name?: string | null; avatarUrl?: string | null; role: string };
}

interface Conversation {
    userId: string;
    name: string;
    role: string;
    avatarUrl?: string | null;
}

interface Props {
    currentUserId: string;
    currentUserRole: string;
    conversations: Conversation[];
    teamId?: string | null;
    teamMembers?: { id: string; name: string | null; role: string; avatarUrl: string | null; updatedAt: string }[];
}

const REACTION_EMOJIS = ["👍", "🔥", "💪", "❤️", "😂", "🎯"];

/* ─── Component ──────────────────────────────────────── */
export function ChatClient({ currentUserId, currentUserRole, conversations, teamId, teamMembers }: Props) {
    const [tab, setTab] = useState<"direct" | "general" | "team">("general");
    const [selectedConv, setSelectedConv] = useState<Conversation | null>(conversations[0] ?? null);

    // Core state
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [stagedMedia, setStagedMedia] = useState<{ url: string; type: "IMAGE" | "VIDEO" } | null>(null);
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Feature state
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState("");
    const [editExpired, setEditExpired] = useState<Record<string, boolean>>({});
    const [reactionPickerId, setReactionPickerId] = useState<string | null>(null);
    const [showMentionDropdown, setShowMentionDropdown] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");
    const [showPinned, setShowPinned] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const [mobileShowChat, setMobileShowChat] = useState(false);

    const bottomRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const isFetchingRef = useRef(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Tab persistence
    useEffect(() => {
        const saved = localStorage.getItem("lastChatTab") as any;
        if (saved && ["direct", "general", "team"].includes(saved)) {
            if (saved === "team" && !teamId) setTab("general");
            else setTab(saved);
        }
    }, [teamId]);

    const handleTabChange = (newTab: "direct" | "general" | "team") => {
        setTab(newTab);
        setReplyTo(null);
        setShowPinned(false);
        localStorage.setItem("lastChatTab", newTab);
    };

    /* ─── Fetch Messages ────────────────────────────── */
    const fetchMessages = useCallback(async () => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        try {
            let url = "";
            if (tab === "general") url = "/api/messages?general=true";
            else if (tab === "team" && teamId) url = `/api/messages?with=${teamId}`;
            else if (tab === "direct" && selectedConv) url = `/api/messages?with=${selectedConv.userId}`;
            else return;

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setMessages(data);

                // Mark seen for messages visible
                const unseenIds = data
                    .filter((m: Message) => m.sender.id !== currentUserId && m.status !== "SEEN")
                    .map((m: Message) => m.id);
                if (unseenIds.length > 0) {
                    for (const id of unseenIds.slice(-5)) {
                        fetch("/api/messages", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id, action: "markSeen" })
                        });
                    }
                }
            }
        } finally {
            isFetchingRef.current = false;
        }
    }, [tab, selectedConv, teamId, currentUserId]);

    useEffect(() => {
        fetchMessages();
        const startPolling = () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(() => {
                if (document.visibilityState === "visible") fetchMessages();
            }, 3000);
        };
        startPolling();
        document.addEventListener("visibilitychange", startPolling);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            document.removeEventListener("visibilitychange", startPolling);
        };
    }, [fetchMessages]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Edit window tracker
    useEffect(() => {
        const check = () => {
            const now = Date.now();
            const expired: Record<string, boolean> = {};
            messages.forEach(m => {
                if (m.sender.id === currentUserId && m.type === "TEXT") {
                    expired[m.id] = now - new Date(m.createdAt).getTime() > 2 * 60 * 1000;
                }
            });
            setEditExpired(expired);
        };
        check();
        const t = setInterval(check, 5000);
        return () => clearInterval(t);
    }, [messages, currentUserId]);

    // Mention helpers
    const mentionableUsers = useMemo(() => {
        const allUsers: { id: string; name: string }[] = [];
        conversations.forEach(c => allUsers.push({ id: c.userId, name: c.name }));
        teamMembers?.forEach(m => {
            if (m.id !== currentUserId && !allUsers.find(u => u.id === m.id)) {
                allUsers.push({ id: m.id, name: m.name || "User" });
            }
        });
        return allUsers;
    }, [conversations, teamMembers, currentUserId]);

    const filteredMentions = useMemo(() => {
        if (!mentionQuery) return mentionableUsers;
        return mentionableUsers.filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase()));
    }, [mentionableUsers, mentionQuery]);

    /* ─── Input Handling ────────────────────────────── */
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInput(val);

        // Check for @ trigger
        const lastAt = val.lastIndexOf("@");
        if (lastAt >= 0 && (lastAt === 0 || val[lastAt - 1] === " ")) {
            const query = val.slice(lastAt + 1);
            if (!query.includes(" ")) {
                setShowMentionDropdown(true);
                setMentionQuery(query);
            } else {
                setShowMentionDropdown(false);
            }
        } else {
            setShowMentionDropdown(false);
        }
    };

    const insertMention = (user: { id: string; name: string }) => {
        const lastAt = input.lastIndexOf("@");
        const before = input.slice(0, lastAt);
        setInput(`${before}@${user.name} `);
        setShowMentionDropdown(false);
        inputRef.current?.focus();
    };

    /* ─── Actions ────────────────────────────────────── */
    const extractMentions = (text: string): string[] => {
        const mentioned: string[] = [];
        mentionableUsers.forEach(u => {
            if (text.includes(`@${u.name}`)) mentioned.push(u.id);
        });
        return mentioned;
    };

    const send = async () => {
        if ((!input.trim() && !stagedMedia) || sending) return;
        setSending(true);
        const mentions = extractMentions(input);
        await fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                content: input.trim() || undefined,
                isGeneral: tab === "general",
                receiverId: tab === "team" ? teamId : (tab === "direct" && selectedConv ? selectedConv.userId : undefined),
                type: stagedMedia ? stagedMedia.type : "TEXT",
                mediaUrl: stagedMedia?.url,
                replyToId: replyTo?.id,
                mentions,
            }),
        });
        setInput("");
        setStagedMedia(null);
        setReplyTo(null);
        setSending(false);
        fetchMessages();
    };

    const saveEdit = async (id: string) => {
        if (!editText.trim()) return;
        const res = await fetch("/api/messages", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, content: editText.trim() }),
        });
        if (res.ok) {
            const updated = await res.json();
            setMessages(prev => prev.map(m => m.id === id ? { ...m, content: updated.content } : m));
        }
        setEditingId(null);
        setEditText("");
    };

    const deleteMessage = async (id: string) => {
        setMenuOpenId(null);
        const res = await fetch("/api/messages", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
        });
        if (res.ok) setMessages(prev => prev.filter(m => m.id !== id));
    };

    const toggleReaction = async (messageId: string, emoji: string) => {
        setReactionPickerId(null);
        const res = await fetch("/api/messages", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: messageId, action: "react", emoji }),
        });
        if (res.ok) {
            const { reactions } = await res.json();
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
        }
    };

    const togglePin = async (id: string) => {
        setMenuOpenId(null);
        const res = await fetch("/api/messages", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, action: "togglePin" }),
        });
        if (res.ok) {
            const updated = await res.json();
            setMessages(prev => prev.map(m => m.id === id ? { ...m, isPinned: updated.isPinned } : m));
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || uploading) return;
        setUploading(true);
        const fd = new FormData();
        fd.append("file", file);
        try {
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            const data = await res.json();
            if (res.ok) {
                const isVideo = data.type?.startsWith("video/");
                setStagedMedia({ url: data.url, type: isVideo ? "VIDEO" : "IMAGE" });
            }
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    /* ─── Derived ────────────────────────────────────── */
    const pinnedMessages = messages.filter(m => m.isPinned);
    const canPin = ["COACH", "SUPER_ADMIN"].includes(currentUserRole) || tab === "direct";

    // Group reactions for display
    const groupReactions = (reactions: ReactionData[]) => {
        const map: Record<string, { emoji: string; count: number; userIds: string[]; names: string[] }> = {};
        reactions.forEach(r => {
            if (!map[r.emoji]) map[r.emoji] = { emoji: r.emoji, count: 0, userIds: [], names: [] };
            map[r.emoji].count++;
            map[r.emoji].userIds.push(r.userId);
            map[r.emoji].names.push(r.user.name || "User");
        });
        return Object.values(map);
    };

    // Render @mentions with highlights
    const renderContent = (text: string) => {
        const parts = text.split(/(@\w[\w\s]*?)(?=\s|$)/g);
        return parts.map((part, i) => {
            const isMention = part.startsWith("@") && mentionableUsers.some(u => part === `@${u.name}`);
            if (isMention) {
                return <span key={i} className="text-brand-400 font-bold">{part}</span>;
            }
            return <span key={i}>{part}</span>;
        });
    };

    // Status icon
    const StatusIcon = ({ status }: { status: string }) => {
        if (status === "SEEN") return <CheckCheck className="w-3.5 h-3.5 text-brand-400" />;
        if (status === "DELIVERED") return <CheckCheck className="w-3.5 h-3.5 text-fg-subtle" />;
        return <Check className="w-3.5 h-3.5 text-fg-subtle" />;
    };

    /* ─── Sidebar Content ────────────────────────────── */
    const renderSidebar = () => (
        <div className="w-72 border-r border-surface-border flex flex-col bg-surface-card">
            {/* Tab Switcher */}
            <div className="p-3 border-b border-surface-border">
                <div className="flex gap-1 bg-surface-muted p-1 rounded-xl">
                    <button
                        onClick={() => handleTabChange("direct")}
                        className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all",
                            tab === "direct" ? "bg-surface-card text-fg shadow-sm" : "text-fg-muted hover:text-fg")}
                    >
                        <MessageSquare className="w-3 h-3" /> Direct
                    </button>
                    {teamId && (
                        <button
                            onClick={() => handleTabChange("team")}
                            className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all",
                                tab === "team" ? "bg-surface-card text-fg shadow-sm" : "text-fg-muted hover:text-fg")}
                        >
                            <Star className="w-3 h-3" /> Team
                        </button>
                    )}
                    <button
                        onClick={() => handleTabChange("general")}
                        className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all",
                            tab === "general" ? "bg-surface-card text-fg shadow-sm" : "text-fg-muted hover:text-fg")}
                    >
                        <Globe className="w-3 h-3" /> Global
                    </button>
                </div>
            </div>

            {/* Conversation List */}
            {tab === "direct" && (
                <div className="flex-1 overflow-y-auto p-2 space-y-0.5 no-scrollbar">
                    {conversations.length === 0 ? (
                        <p className="text-xs text-fg-muted text-center p-6">No conversations yet</p>
                    ) : (
                        conversations.map((conv) => (
                            <button
                                key={conv.userId}
                                onClick={() => { setSelectedConv(conv); setMobileShowChat(true); }}
                                className={cn("w-full text-left flex items-center gap-3 p-3 rounded-xl transition-all",
                                    selectedConv?.userId === conv.userId
                                        ? "bg-brand-500/10 border border-brand-500/20"
                                        : "hover:bg-surface-muted border border-transparent")}
                            >
                                <div className="w-10 h-10 rounded-full bg-gradient-brand flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden">
                                    {conv.avatarUrl
                                        ? <img src={conv.avatarUrl} alt={conv.name} className="w-full h-full object-cover" />
                                        : getInitials(conv.name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1">
                                        <p className="text-sm font-bold text-fg truncate">{conv.name}</p>
                                        {["COACH", "SUPER_ADMIN"].includes(conv.role) && (
                                            <Star className="w-3 h-3 text-brand-400 fill-brand-400 shrink-0" />
                                        )}
                                    </div>
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-fg-subtle">{roleLabels[conv.role] ?? conv.role}</p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}

            {tab === "team" && (
                <div className="flex-1 overflow-y-auto p-2 space-y-0.5 no-scrollbar">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-fg-subtle px-3 mt-2 mb-2">Team Roster</h4>
                    {teamMembers?.map((m) => {
                        const isOnline = m.updatedAt && (Date.now() - new Date(m.updatedAt).getTime() < 15 * 60 * 1000);
                        return (
                            <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-muted transition-all">
                                <div className="relative">
                                    <div className="w-9 h-9 rounded-full bg-gradient-brand flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden">
                                        {m.avatarUrl ? <img src={m.avatarUrl} alt={m.name ?? "User"} className="w-full h-full object-cover" /> : getInitials(m.name)}
                                    </div>
                                    <div className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-card", isOnline ? "bg-success" : "bg-fg-muted/30")} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-fg truncate">{m.name ?? "Athlete"}</p>
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-fg-subtle">{roleLabels[m.role] ?? m.role}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {tab === "general" && (
                <div className="flex-1 flex items-center justify-center p-6 text-center">
                    <div>
                        <Globe className="w-10 h-10 text-brand-400/30 mx-auto mb-3" />
                        <p className="text-sm font-bold text-fg-muted">Community Chat</p>
                        <p className="text-[10px] text-fg-subtle mt-1">Open to all members</p>
                    </div>
                </div>
            )}
        </div>
    );

    /* ─── Main Render ────────────────────────────────── */
    return (
        <div className="flex h-[calc(100vh-4rem)] animate-fade-in" onClick={() => { setMenuOpenId(null); setReactionPickerId(null); }}>
            {/* Desktop Sidebar */}
            <div className="hidden sm:flex">
                {renderSidebar()}
            </div>

            {/* Mobile: Show sidebar or chat */}
            <div className="sm:hidden flex-1 flex flex-col min-w-0">
                {!mobileShowChat ? (
                    <div className="flex flex-col h-full">
                        {renderSidebar()}
                    </div>
                ) : null}
            </div>

            {/* Chat Area */}
            <div className={cn("flex-1 flex flex-col min-w-0", !mobileShowChat && "hidden sm:flex")}>
                {/* ── Header ── */}
                <div className="h-14 flex items-center justify-between px-5 border-b border-surface-border bg-surface-card/80 backdrop-blur-md shrink-0">
                    <div className="flex items-center gap-3">
                        <button className="sm:hidden btn-icon" onClick={() => setMobileShowChat(false)}>
                            <ChevronDown className="w-4 h-4 rotate-90" />
                        </button>
                        {tab === "team" ? (
                            <>
                                <Star className="w-5 h-5 text-brand-400" />
                                <div>
                                    <p className="font-bold text-sm">Team Chat</p>
                                    <p className="text-[10px] text-fg-muted font-medium">Coach & Athletes</p>
                                </div>
                            </>
                        ) : tab === "general" ? (
                            <>
                                <Globe className="w-5 h-5 text-brand-400" />
                                <div>
                                    <p className="font-bold text-sm">General Chat</p>
                                    <p className="text-[10px] text-fg-muted font-medium">Community</p>
                                </div>
                            </>
                        ) : selectedConv ? (
                            <>
                                <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                                    {selectedConv.avatarUrl
                                        ? <img src={selectedConv.avatarUrl} alt={selectedConv.name} className="w-full h-full object-cover" />
                                        : getInitials(selectedConv.name)}
                                </div>
                                <div>
                                    <p className="font-bold text-sm">{selectedConv.name}</p>
                                    <p className="text-[10px] text-fg-muted font-medium">{roleLabels[selectedConv.role] ?? selectedConv.role}</p>
                                </div>
                            </>
                        ) : (
                            <p className="text-fg-muted text-sm">Select a conversation</p>
                        )}
                    </div>

                    {pinnedMessages.length > 0 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowPinned(!showPinned); }}
                            className={cn("btn-icon relative", showPinned && "text-brand-400")}
                        >
                            <Pin className="w-4 h-4" />
                            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                                {pinnedMessages.length}
                            </span>
                        </button>
                    )}
                </div>

                {/* ── Pinned Messages Banner ── */}
                {showPinned && pinnedMessages.length > 0 && (
                    <div className="border-b border-surface-border bg-brand-500/5 px-5 py-3 space-y-2 animate-slide-up max-h-40 overflow-y-auto no-scrollbar">
                        <div className="flex items-center gap-2 mb-1">
                            <Pin className="w-3 h-3 text-brand-400" />
                            <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Pinned Messages</span>
                        </div>
                        {pinnedMessages.map(pm => (
                            <div key={pm.id} className="flex items-center gap-2 text-xs text-fg-muted">
                                <span className="font-bold text-fg">{pm.sender.name}:</span>
                                <span className="truncate">{pm.content || "[media]"}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Messages ── */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 no-scrollbar">
                    {messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <MessageSquare className="w-10 h-10 text-fg-subtle/20 mx-auto mb-3" />
                                <p className="text-fg-muted text-sm font-medium">No messages yet. Say hello! 👋</p>
                            </div>
                        </div>
                    ) : (
                        messages.map((msg, idx) => {
                            const isMine = msg.sender.id === currentUserId;
                            const canEdit = isMine && msg.type === "TEXT" && !editExpired[msg.id];
                            const isEditing = editingId === msg.id;
                            const reactions = groupReactions(msg.reactions || []);

                            // Show date separator
                            const prevMsg = idx > 0 ? messages[idx - 1] : null;
                            const showDate = !prevMsg || new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

                            return (
                                <div key={msg.id}>
                                    {showDate && (
                                        <div className="flex items-center gap-3 py-3">
                                            <div className="flex-1 h-px bg-surface-border" />
                                            <span className="text-[10px] font-bold text-fg-subtle uppercase tracking-widest">
                                                {new Date(msg.createdAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                            </span>
                                            <div className="flex-1 h-px bg-surface-border" />
                                        </div>
                                    )}

                                    <div className={cn("flex items-end gap-2 group", isMine && "flex-row-reverse")}>
                                        {/* Avatar */}
                                        {!isMine && (
                                            <div className="w-7 h-7 rounded-full bg-gradient-brand flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 overflow-hidden mb-5">
                                                {msg.sender.avatarUrl
                                                    ? <img src={msg.sender.avatarUrl} alt={msg.sender.name ?? ""} className="w-full h-full object-cover" />
                                                    : getInitials(msg.sender.name)}
                                            </div>
                                        )}

                                        <div className={cn("max-w-[70%] relative", isMine && "items-end flex flex-col")}>
                                            {/* Sender name */}
                                            {!isMine && (
                                                <p className="text-[10px] text-fg-muted mb-1 ml-1 flex items-center gap-1.5">
                                                    {msg.sender.name}
                                                    {["COACH", "SUPER_ADMIN"].includes(msg.sender.role) && (
                                                        <span className="text-[8px] px-1 bg-brand-500/20 border border-brand-500/20 text-brand-400 rounded-sm font-black uppercase tracking-tighter">Coach</span>
                                                    )}
                                                </p>
                                            )}

                                            {/* Reply preview */}
                                            {msg.replyTo && (
                                                <div className={cn(
                                                    "text-[10px] px-3 py-1.5 rounded-lg mb-1 max-w-xs truncate border-l-2",
                                                    isMine
                                                        ? "bg-white/5 border-l-white/20 text-white/60"
                                                        : "bg-surface-elevated border-l-brand-500/40 text-fg-muted"
                                                )}>
                                                    <span className="font-bold">{msg.replyTo.sender.name}</span>: {msg.replyTo.content || "[media]"}
                                                </div>
                                            )}

                                            {/* Message content */}
                                            {isEditing ? (
                                                <div className="flex items-center gap-2 min-w-[200px]">
                                                    <input
                                                        autoFocus
                                                        className="input flex-1 h-9 text-sm py-0 px-3"
                                                        value={editText}
                                                        onChange={e => setEditText(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === "Enter") saveEdit(msg.id);
                                                            if (e.key === "Escape") { setEditingId(null); setEditText(""); }
                                                        }}
                                                    />
                                                    <button onClick={() => saveEdit(msg.id)} className="btn-icon w-8 h-8 bg-success/10 text-success hover:bg-success/20"><Check className="w-4 h-4" /></button>
                                                    <button onClick={() => { setEditingId(null); setEditText(""); }} className="btn-icon w-8 h-8"><X className="w-4 h-4" /></button>
                                                </div>
                                            ) : msg.type === "TEXT" ? (
                                                <div className={cn(isMine ? "bubble-sent" : "bubble-received", msg.isPinned && "ring-1 ring-brand-400/30")}>
                                                    {renderContent(msg.content || "")}
                                                    {msg.updatedAt && (new Date(msg.updatedAt).getTime() - new Date(msg.createdAt).getTime() > 1000) && (
                                                        <span className="text-[9px] opacity-50 ml-2 italic">(edited)</span>
                                                    )}
                                                </div>
                                            ) : msg.type === "VIDEO" ? (
                                                <video src={msg.mediaUrl ?? ""} controls className="max-w-xs rounded-2xl" />
                                            ) : (
                                                <img src={msg.mediaUrl ?? ""} alt="media" className="max-w-xs rounded-2xl" />
                                            )}

                                            {/* Reactions */}
                                            {reactions.length > 0 && (
                                                <div className={cn("flex flex-wrap gap-1 mt-1", isMine && "justify-end")}>
                                                    {reactions.map(r => (
                                                        <button
                                                            key={r.emoji}
                                                            onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, r.emoji); }}
                                                            className={cn(
                                                                "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all border",
                                                                r.userIds.includes(currentUserId)
                                                                    ? "bg-brand-500/10 border-brand-500/30 text-brand-400"
                                                                    : "bg-surface-muted/50 border-surface-border text-fg-muted hover:bg-surface-muted"
                                                            )}
                                                            title={r.names.join(", ")}
                                                        >
                                                            <span>{r.emoji}</span>
                                                            {r.count > 1 && <span className="text-[10px] font-bold">{r.count}</span>}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Timestamp + Status */}
                                            <div className={cn("flex items-center gap-1.5 mt-1", isMine && "justify-end")}>
                                                <p className="text-[10px] text-fg-subtle">{formatRelative(msg.createdAt)}</p>
                                                {isMine && <StatusIcon status={msg.status} />}
                                                {msg.isPinned && <Pin className="w-2.5 h-2.5 text-brand-400" />}
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        {!isEditing && (
                                            <div className={cn("flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity", isMine && "order-first")}>
                                                {/* Reply */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setReplyTo(msg); inputRef.current?.focus(); }}
                                                    className="btn-icon w-7 h-7 rounded-lg"
                                                    title="Reply"
                                                >
                                                    <Reply className="w-3.5 h-3.5" />
                                                </button>

                                                {/* React */}
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setReactionPickerId(reactionPickerId === msg.id ? null : msg.id); }}
                                                        className="btn-icon w-7 h-7 rounded-lg"
                                                        title="React"
                                                    >
                                                        <SmilePlus className="w-3.5 h-3.5" />
                                                    </button>
                                                    {reactionPickerId === msg.id && (
                                                        <div
                                                            className={cn(
                                                                "absolute bottom-8 z-50 flex gap-1 bg-surface-elevated border border-surface-border rounded-xl p-1.5 shadow-2xl animate-scale-in",
                                                                isMine ? "right-0" : "left-0"
                                                            )}
                                                            onClick={e => e.stopPropagation()}
                                                        >
                                                            {REACTION_EMOJIS.map(emoji => (
                                                                <button
                                                                    key={emoji}
                                                                    onClick={() => toggleReaction(msg.id, emoji)}
                                                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-muted transition-colors text-base"
                                                                >
                                                                    {emoji}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* More Menu */}
                                                {(isMine || canPin) && (
                                                    <div className="relative">
                                                        <button
                                                            onClick={e => { e.stopPropagation(); setMenuOpenId(menuOpenId === msg.id ? null : msg.id); }}
                                                            className="btn-icon w-7 h-7 rounded-lg"
                                                        >
                                                            <MoreVertical className="w-3.5 h-3.5" />
                                                        </button>
                                                        {menuOpenId === msg.id && (
                                                            <div
                                                                className={cn(
                                                                    "absolute bottom-8 z-50 bg-surface-elevated border border-surface-border rounded-xl shadow-2xl overflow-hidden min-w-[140px]",
                                                                    isMine ? "right-0" : "left-0"
                                                                )}
                                                                onClick={e => e.stopPropagation()}
                                                            >
                                                                {canPin && (
                                                                    <button
                                                                        onClick={() => togglePin(msg.id)}
                                                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-fg hover:bg-surface-muted transition-colors"
                                                                    >
                                                                        <Pin className="w-3.5 h-3.5 text-brand-400" />
                                                                        {msg.isPinned ? "Unpin" : "Pin"}
                                                                    </button>
                                                                )}
                                                                {isMine && canEdit && (
                                                                    <button
                                                                        onClick={() => { setEditingId(msg.id); setEditText(msg.content ?? ""); setMenuOpenId(null); }}
                                                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-fg hover:bg-surface-muted transition-colors"
                                                                    >
                                                                        <Pencil className="w-3.5 h-3.5 text-brand-400" /> Edit
                                                                    </button>
                                                                )}
                                                                {isMine && (
                                                                    <button
                                                                        onClick={() => deleteMessage(msg.id)}
                                                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-danger hover:bg-danger/5 transition-colors border-t border-surface-border"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" /> Delete
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* ── Input Area ── */}
                <div className="px-5 py-3 border-t border-surface-border bg-surface-card shrink-0">
                    {/* Reply preview */}
                    {replyTo && (
                        <div className="flex items-center justify-between gap-3 mb-2 px-3 py-2 bg-surface-muted/50 rounded-xl border-l-2 border-l-brand-500 animate-slide-up">
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-brand-400">Replying to {replyTo.sender.name}</p>
                                <p className="text-xs text-fg-muted truncate">{replyTo.content || "[media]"}</p>
                            </div>
                            <button onClick={() => setReplyTo(null)} className="btn-icon w-6 h-6 shrink-0">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    {/* Staged media */}
                    {stagedMedia && (
                        <div className="mb-3 relative inline-block animate-slide-up">
                            <div className="relative rounded-2xl overflow-hidden border border-brand-500/30 max-w-[200px]">
                                {stagedMedia.type === "IMAGE" ? (
                                    <img src={stagedMedia.url} alt="Staged" className="w-full h-auto object-cover max-h-32" />
                                ) : (
                                    <video src={stagedMedia.url} className="w-full h-auto max-h-32" muted />
                                )}
                            </div>
                            <button onClick={() => setStagedMedia(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-danger rounded-full flex items-center justify-center text-white shadow-lg hover:bg-danger-600 transition-colors">
                                <X className="w-3 h-3" strokeWidth={3} />
                            </button>
                        </div>
                    )}

                    {/* Mention dropdown */}
                    {showMentionDropdown && filteredMentions.length > 0 && (
                        <div className="mb-2 bg-surface-elevated border border-surface-border rounded-xl shadow-2xl max-h-[150px] overflow-y-auto no-scrollbar animate-slide-up">
                            {filteredMentions.map(u => (
                                <button
                                    key={u.id}
                                    onClick={() => insertMention(u)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-fg hover:bg-brand-500/10 hover:text-brand-400 transition-colors border-b last:border-0 border-surface-border/50"
                                >
                                    <AtSign className="w-3 h-3 text-brand-400" />
                                    {u.name}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <input type="file" className="hidden" ref={fileRef} onChange={handleUpload} accept="image/*,video/*" />
                        <button className="btn-icon shrink-0" onClick={() => fileRef.current?.click()} disabled={uploading}>
                            <ImageIcon className={cn("w-4 h-4", stagedMedia ? "text-brand-400" : "text-fg-subtle")} />
                        </button>
                        <input
                            ref={inputRef}
                            type="text"
                            className="input flex-1 h-10 py-0"
                            placeholder={replyTo ? "Write a reply..." : stagedMedia ? "Add caption..." : "Message..."}
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={(e) => e.key === "Enter" && send()}
                        />
                        <button
                            onClick={send}
                            disabled={(!input.trim() && !stagedMedia) || sending}
                            className={cn("w-10 h-10 p-0 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0",
                                (input.trim() || stagedMedia) ? "btn-primary" : "bg-surface-muted text-fg-subtle")}
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
