"use client";

import { createContext, useContext, type ReactNode } from "react";

export type AppUser = {
    id: string;
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
};

const AppUserContext = createContext<AppUser | null>(null);

export function AppUserProvider({
    children,
    user,
}: {
    children: ReactNode;
    user: AppUser;
}) {
    return <AppUserContext.Provider value={user}>{children}</AppUserContext.Provider>;
}

export function useAppUser() {
    return useContext(AppUserContext);
}
