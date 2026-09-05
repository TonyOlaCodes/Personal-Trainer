"use client";

import { useRef, useState, type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { resolveUploadUrl } from "@/lib/uploadUrls";

export interface TolgSelectOption {
    value: string;
    label: string;
    avatarUrl?: string | null;
    hint?: string;
}

export function TolgSelectMenu({
    value,
    onValueChange,
    options,
    children,
    ariaLabel,
    align = "end",
    minWidthRef,
    triggerClassName,
    triggerId,
}: {
    value: string | null;
    onValueChange: (value: string) => void;
    options: TolgSelectOption[];
    children: ReactNode;
    ariaLabel: string;
    align?: "start" | "center" | "end";
    /** When set, the menu is at least as wide as this element. */
    minWidthRef?: React.RefObject<HTMLElement | null>;
    triggerClassName?: string;
    triggerId?: string;
}) {
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [menuWidth, setMenuWidth] = useState<number | undefined>(undefined);

    return (
        <DropdownMenu.Root
            onOpenChange={(open) => {
                if (!open) return;
                const anchor = minWidthRef?.current ?? triggerRef.current;
                if (anchor) setMenuWidth(Math.max(anchor.offsetWidth, 220));
            }}
        >
            <DropdownMenu.Trigger asChild>
                <button
                    ref={triggerRef}
                    id={triggerId}
                    type="button"
                    aria-label={ariaLabel}
                    className={cn("outline-none", triggerClassName)}
                >
                    {children}
                </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align={align}
                    sideOffset={8}
                    collisionPadding={12}
                    loop
                    style={menuWidth ? { minWidth: menuWidth } : undefined}
                    className="z-[80] max-h-72 overflow-y-auto overscroll-contain rounded-2xl border border-surface-border bg-surface-elevated p-1 text-fg shadow-modal outline-none [color-scheme:dark]"
                >
                    <DropdownMenu.RadioGroup
                        value={value ?? undefined}
                        onValueChange={onValueChange}
                    >
                        {options.map((option) => {
                            const selected = option.value === value;
                            return (
                                <DropdownMenu.RadioItem
                                    key={option.value}
                                    value={option.value}
                                    className={cn(
                                        "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm outline-none cursor-pointer select-none",
                                        "text-fg data-[highlighted]:bg-brand-500/15 data-[highlighted]:text-fg",
                                        "data-[state=checked]:bg-brand-500/10",
                                        selected && "bg-brand-500/10"
                                    )}
                                >
                                    <span className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center text-[11px] font-bold text-white overflow-hidden shrink-0">
                                        {option.avatarUrl ? (
                                            <img
                                                src={resolveUploadUrl(option.avatarUrl)}
                                                alt=""
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            getInitials(option.label)
                                        )}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-bold truncate">{option.label}</span>
                                        {option.hint && (
                                            <span className="block text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
                                                {option.hint}
                                            </span>
                                        )}
                                    </span>
                                    <Check
                                        className={cn(
                                            "w-4 h-4 shrink-0 text-brand-400",
                                            selected ? "opacity-100" : "opacity-0"
                                        )}
                                        aria-hidden={!selected}
                                    />
                                </DropdownMenu.RadioItem>
                            );
                        })}
                    </DropdownMenu.RadioGroup>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}
