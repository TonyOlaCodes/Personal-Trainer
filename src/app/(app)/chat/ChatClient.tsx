"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Image as ImageIcon, Globe, MessageSquare, Lock, Star, X } from "lucide-react";
import { getInitials, formatRelative, cn, roleLabels } from "@/lib/utils";

interface Message {
    id: string;
    content?: string | null;
    mediaUrl?: string | null;
    type: string;
    isGeneral: boolean;
    createdAt: string;
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
}

export function ChatClient({ currentUserId, currentUserRole, conversations }: Props) {
    const [tab, setTab] = useState<"direct" | "general">("general");
    const [selectedConv, setSelectedConv] = useState<Conversation | null>(conversations[0] ?? null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [stagedMedia, setStagedMedia] = useState<{ url: string; type: "IMAGE" | "VIDEO" } | null>(null);
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const fetchMessages = useCallback(async () => {
        let url = "";
        if (tab === "general") {
            url = "/api/messages?general=true";
        } else if (selectedConv) {
            url = `/api/messages?with=${selectedConv.userId}`;
        } else return;

        const res = await fetch(url);
        if (res.ok) setMessages(await res.json());
    }, [tab, selectedConv]);

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 3000); // polling
        return () => clearInterval(interval);
    }, [fetchMessages]);

    // scroll to bottom
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const send = async () => {
        if ((!input.trim() && !stagedMedia) || sending) return;
        setSending(true);
        await fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                content: input.trim() || undefined,
                isGeneral: tab === "general",
                receiverId: tab === "direct" && selectedConv ? selectedConv.userId : undefined,
                type: stagedMedia ? stagedMedia.type : "TEXT",
                mediaUrl: stagedMedia?.url
            }),
        });
        setInput("");
        setStagedMedia(null);
        setSending(false);
        fetchMessages();
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
        <div className="flex h-[calc(100vh-4rem)] animate-fade-in">
            {/* Sidebar: conversations or tab selector */}
            <div className="w-64 border-r border-surface-border flex flex-col bg-surface-card hidden sm:flex">
                {/* Tab toggle */}
                <div className="p-3 border-b border-surface-border">
                    <div className="flex gap-1 bg-surface-muted p-1 rounded-xl">
                        <button
                            onClick={() => setTab("direct")}
                            className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                                tab === "direct" ? "bg-surface-card text-fg shadow-card" : "text-fg-muted")}
                        >
                            <MessageSquare className="w-3 h-3" /> Direct
                        </button>
                        <button
                            onClick={() => setTab("general")}
                            className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                                tab === "general" ? "bg-surface-card text-fg shadow-card" : "text-fg-muted")}
                        >
                            <Globe className="w-3 h-3" /> General
                        </button>
                    </div>
                </div>

                {/* Conversation list */}
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
                                    <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                        {conv.avatarUrl
                                            ? <img src={conv.avatarUrl} alt={conv.name} className="rounded-full" />
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
                {/* Chat header */}
                <div className="h-14 flex items-center px-5 border-b border-surface-border gap-3">
                    {tab === "general" ? (
                        <>
                            <Globe className="w-5 h-5 text-brand-400" />
                            <div>
                                <p className="font-semibold text-sm">General Chat</p>
                                <p className="text-xs text-fg-muted">Community area</p>
                            </div>
                        </>
                    ) : selectedConv ? (
                        <>
                            <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-xs font-bold text-white">
                                {getInitials(selectedConv.name)}
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
                            return (
                                <div key={msg.id} className={cn("flex items-end gap-2", isMine && "flex-row-reverse")}>
                                    {!isMine && (
                                        <div className="w-7 h-7 rounded-full bg-gradient-brand flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                                            {getInitials(msg.sender.name)}
                                        </div>
                                    )}
                                    <div className="max-w-[70%]">
                                        {!isMine && (
                                            <p className="text-[10px] text-fg-muted mb-1 ml-1 flex items-center gap-1.5">
                                                {msg.sender.name}
                                                {["COACH", "SUPER_ADMIN"].includes(msg.sender.role) && (
                                                    <span className="text-[8px] px-1 bg-brand-500/20 shadow-inner border border-brand-500/20 text-brand-400 rounded-sm font-black uppercase tracking-tighter">Coach</span>
                                                )}
                                            </p>
                                        )}
                                        {msg.type === "TEXT" ? (
                                            <div className={isMine ? "bubble-sent" : "bubble-received"}>
                                                {msg.content}
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
                                </div>
                            );
                        })
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Staging & Action Area */}
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
