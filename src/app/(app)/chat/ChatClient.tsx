"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Image as ImageIcon, Globe, MessageSquare, Lock, Star, X, Pencil, Trash2, Check, MoreVertical } from "lucide-react";
import { getInitials, formatRelative, cn, roleLabels } from "@/lib/utils";

interface Message {
    id: string;
    content?: string | null;
    mediaUrl?: string | null;
    type: string;
    isGeneral: boolean;
    createdAt: string;
    updatedAt?: string | null;
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

export function ChatClient({ currentUserId, currentUserRole, conversations, teamId, teamMembers }: Props) {
    const [tab, setTab] = useState<"direct" | "general" | "team">("general");
    const [selectedConv, setSelectedConv] = useState<Conversation | null>(conversations[0] ?? null);

    // Persistence for chat tab
    useEffect(() => {
        const saved = localStorage.getItem("lastChatTab") as any;
        if (saved && ["direct", "general", "team"].includes(saved)) {
            if (saved === "team" && !teamId) setTab("general");
            else setTab(saved);
        }
    }, [teamId]);

    const handleTabChange = (newTab: "direct" | "general" | "team") => {
        setTab(newTab);
        localStorage.setItem("lastChatTab", newTab);
    };
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [stagedMedia, setStagedMedia] = useState<{ url: string; type: "IMAGE" | "VIDEO" } | null>(null);
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Edit / delete state
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState("");
    const [editExpired, setEditExpired] = useState<Record<string, boolean>>({});

    const bottomRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const isFetchingRef = useRef(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchMessages = useCallback(async () => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        try {
            let url = "";
            if (tab === "general") {
                url = "/api/messages?general=true";
            } else if (tab === "team" && teamId) {
                url = `/api/messages?with=${teamId}`;
            } else if (tab === "direct" && selectedConv) {
                url = `/api/messages?with=${selectedConv.userId}`;
            } else return;

            const res = await fetch(url);
            if (res.ok) setMessages(await res.json());
        } finally {
            isFetchingRef.current = false;
        }
    }, [tab, selectedConv, teamId]);

    useEffect(() => {
        fetchMessages();

        const startPolling = () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(() => {
                if (document.visibilityState === "visible") fetchMessages();
            }, 4000);
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

    // Track which sent messages are still within the 2-min edit window
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

    const send = async () => {
        if ((!input.trim() && !stagedMedia) || sending) return;
        setSending(true);
        await fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                content: input.trim() || undefined,
                isGeneral: tab === "general",
                receiverId: tab === "team" ? teamId : (tab === "direct" && selectedConv ? selectedConv.userId : undefined),
                type: stagedMedia ? stagedMedia.type : "TEXT",
                mediaUrl: stagedMedia?.url
            }),
        });
        setInput("");
        setStagedMedia(null);
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
        } else {
            const err = await res.json();
            alert(err.error);
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
        if (res.ok) {
            setMessages(prev => prev.filter(m => m.id !== id));
        } else {
            const err = await res.json();
            alert(err.error);
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
                setStagedMedia({
                    url: data.url,
                    type: isVideo ? "VIDEO" : "IMAGE"
                });
            }
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    return (
        <div className="flex h-[calc(100vh-4rem)] animate-fade-in" onClick={() => setMenuOpenId(null)}>
            {/* Sidebar */}
            <div className="w-64 border-r border-surface-border flex flex-col bg-surface-card hidden sm:flex">
                <div className="p-3 border-b border-surface-border">
                    <div className="flex gap-1 bg-surface-muted p-1 rounded-xl">
                        <button
                            onClick={() => handleTabChange("direct")}
                            className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                                tab === "direct" ? "bg-surface-card text-fg shadow-card" : "text-fg-muted")}
                        >
                            <MessageSquare className="w-3 h-3" /> Direct
                        </button>
                        {teamId && (
                            <button
                                onClick={() => handleTabChange("team")}
                                className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                                    tab === "team" ? "bg-surface-card text-fg shadow-card" : "text-fg-muted")}
                            >
                                <Star className="w-3 h-3" /> Team
                            </button>
                        )}
                        <button
                            onClick={() => handleTabChange("general")}
                            className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                                tab === "general" ? "bg-surface-card text-fg shadow-card" : "text-fg-muted")}
                        >
                            <Globe className="w-3 h-3" /> General
                        </button>
                    </div>
                </div>

                {tab === "direct" && (
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {conversations.length === 0 ? (
                            <p className="text-xs text-fg-muted text-center p-4">No conversations yet</p>
                        ) : (
                            conversations.map((conv) => (
                                <button
                                    key={conv.userId}
                                    onClick={() => setSelectedConv(conv)}
                                    className={cn("w-full text-left flex items-center gap-3 p-3 rounded-xl transition-all",
                                        selectedConv?.userId === conv.userId
                                            ? "bg-brand-950/60 border border-brand-700/40"
                                            : "hover:bg-surface-muted")}
                                >
                                    <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden">
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
                                        <p className="text-[10px] uppercase font-black tracking-widest text-fg-subtle">{roleLabels[conv.role] ?? conv.role}</p>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                )}
                {tab === "team" && (
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-fg-subtle px-3 mt-2 mb-2">Team Roster</h4>
                        {teamMembers?.map((m) => {
                            // Consider online if active in the last 15 minutes (since we update it periodically vs WebSockets)
                            const isOnline = m.updatedAt && (Date.now() - new Date(m.updatedAt).getTime() < 15 * 60 * 1000);
                            
                            return (
                                <div key={m.id} className="w-full text-left flex items-center gap-3 p-2 rounded-xl hover:bg-surface-muted transition-all">
                                    <div className="relative">
                                        <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden">
                                            {m.avatarUrl ? <img src={m.avatarUrl} alt={m.name ?? "User"} className="w-full h-full object-cover" /> : getInitials(m.name)}
                                        </div>
                                        <div 
                                            className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-card", isOnline ? "bg-success" : "bg-fg-muted")} 
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-1">
                                            <p className="text-sm font-bold text-fg truncate">{m.name ?? "Athlete"}</p>
                                        </div>
                                        <p className="text-[10px] uppercase font-black tracking-widest text-fg-subtle">{roleLabels[m.role] ?? m.role}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {tab === "general" && (
                    <div className="flex-1 flex items-center justify-center p-4 text-center">
                        <div>
                            <Globe className="w-8 h-8 text-brand-400 mx-auto mb-2" />
                            <p className="text-sm text-fg-muted">Global chat — community area</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Chat area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="h-14 flex items-center px-5 border-b border-surface-border gap-3">
                    {tab === "team" ? (
                        <>
                            <Star className="w-5 h-5 text-brand-400" />
                            <div>
                                <p className="font-semibold text-sm">Team Chat</p>
                                <p className="text-xs text-fg-muted">Coach & Athletes</p>
                            </div>
                        </>
                    ) : tab === "general" ? (
                        <>
                            <Globe className="w-5 h-5 text-brand-400" />
                            <div>
                                <p className="font-semibold text-sm">General Chat</p>
                                <p className="text-xs text-fg-muted">Community area</p>
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
                                <p className="font-semibold text-sm">{selectedConv.name}</p>
                                <p className="text-xs text-fg-muted">{roleLabels[selectedConv.role] ?? selectedConv.role}</p>
                            </div>
                        </>
                    ) : (
                        <p className="text-fg-muted text-sm">Select a conversation</p>
                    )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-fg-muted text-sm">No messages yet. Say hello! 👋</p>
                        </div>
                    ) : (
                        messages.map((msg) => {
                            const isMine = msg.sender.id === currentUserId;
                            const canEdit = isMine && msg.type === "TEXT" && !editExpired[msg.id];
                            const isEditing = editingId === msg.id;

                            return (
                                <div key={msg.id} className={cn("flex items-end gap-2 group", isMine && "flex-row-reverse")}>
                                    {!isMine && (
                                        <div className="w-7 h-7 rounded-full bg-gradient-brand flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 overflow-hidden">
                                            {msg.sender.avatarUrl
                                                ? <img src={msg.sender.avatarUrl} alt={msg.sender.name ?? ""} className="w-full h-full object-cover" />
                                                : getInitials(msg.sender.name)}
                                        </div>
                                    )}
                                    <div className={cn("max-w-[70%] relative", isMine && "items-end flex flex-col")}>
                                        {!isMine && (
                                            <p className="text-[10px] text-fg-muted mb-1 ml-1 flex items-center gap-1.5">
                                                {msg.sender.name}
                                                {["COACH", "SUPER_ADMIN"].includes(msg.sender.role) && (
                                                    <span className="text-[8px] px-1 bg-brand-500/20 shadow-inner border border-brand-500/20 text-brand-400 rounded-sm font-black uppercase tracking-tighter">Coach</span>
                                                )}
                                            </p>
                                        )}

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
                                            <div className={isMine ? "bubble-sent" : "bubble-received"}>
                                                {msg.content}
                                                {msg.updatedAt && (new Date(msg.updatedAt).getTime() - new Date(msg.createdAt).getTime() > 1000) && (
                                                    <span className="text-[9px] opacity-50 ml-2 italic">(edited)</span>
                                                )}
                                            </div>
                                        ) : msg.type === "VIDEO" ? (
                                            <video src={msg.mediaUrl ?? ""} controls className="max-w-xs rounded-xl" />
                                        ) : (
                                            <img src={msg.mediaUrl ?? ""} alt="media" className="max-w-xs rounded-xl" />
                                        )}

                                        <p className={cn("text-[10px] text-fg-subtle mt-1", isMine && "text-right")}>
                                            {formatRelative(msg.createdAt)}
                                        </p>
                                    </div>

                                    {/* Action menu — only for own messages */}
                                    {isMine && !isEditing && (
                                        <div className={cn("flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity relative", isMine && "order-first mr-1")}>
                                            <button
                                                onClick={e => { e.stopPropagation(); setMenuOpenId(menuOpenId === msg.id ? null : msg.id); }}
                                                className="btn-icon w-7 h-7 rounded-lg"
                                            >
                                                <MoreVertical className="w-3.5 h-3.5" />
                                            </button>
                                            {menuOpenId === msg.id && (
                                                <div
                                                    className="absolute bottom-8 right-0 z-50 bg-surface-elevated border border-surface-border rounded-xl shadow-card overflow-hidden min-w-[130px]"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    {canEdit && (
                                                        <button
                                                            onClick={() => {
                                                                setEditingId(msg.id);
                                                                setEditText(msg.content ?? "");
                                                                setMenuOpenId(null);
                                                            }}
                                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-fg hover:bg-surface-muted transition-colors"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5 text-brand-400" />
                                                            Edit
                                                        </button>
                                                    )}
                                                    {!canEdit && msg.type === "TEXT" && (
                                                        <div className="px-4 py-2.5 text-[10px] text-fg-subtle italic">Edit window expired</div>
                                                    )}
                                                    <button
                                                        onClick={() => deleteMessage(msg.id)}
                                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-danger hover:bg-danger/5 transition-colors border-t border-surface-border"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                        Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Input area */}
                <div className="px-5 py-4 border-t border-surface-border bg-surface-card">
                    {stagedMedia && (
                        <div className="mb-3 relative inline-block animate-in slide-in-from-bottom-2 duration-300">
                            <div className="relative rounded-2xl overflow-hidden border border-brand-500/30 shadow-glow-brand-sm max-w-[200px]">
                                {stagedMedia.type === "IMAGE" ? (
                                    <img src={stagedMedia.url} alt="Staged" className="w-full h-auto object-cover max-h-32" />
                                ) : (
                                    <video src={stagedMedia.url} className="w-full h-auto max-h-32" muted />
                                )}
                            </div>
                            <button onClick={() => setStagedMedia(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-danger rounded-full flex items-center justify-center text-white shadow-lg select-none hover:bg-danger-600 transition-colors">
                                <X className="w-3 h-3" strokeWidth={3} />
                            </button>
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <input type="file" className="hidden" ref={fileRef} onChange={handleUpload} accept="image/*,video/*" />
                        <button className="btn-icon" onClick={() => fileRef.current?.click()} disabled={uploading}>
                            <ImageIcon className={cn("w-4 h-4", stagedMedia ? "text-brand-400" : "text-fg-subtle")} />
                        </button>
                        <input
                            type="text"
                            className="input flex-1 h-10 py-0"
                            placeholder={stagedMedia ? "Add caption..." : "Message..."}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && send()}
                        />
                        <button
                            onClick={send}
                            disabled={(!input.trim() && !stagedMedia) || sending}
                            className={cn("w-10 h-10 p-0 rounded-xl transition-all shadow-sm flex items-center justify-center", (input.trim() || stagedMedia) ? "btn-primary" : "bg-surface-muted text-fg-subtle")}
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
