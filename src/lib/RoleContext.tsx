"use client";

import { createContext, useContext, ReactNode } from "react";

const RoleContext = createContext<string>("FREE");

export function RoleProvider({ children, role }: { children: ReactNode; role: string }) {
    return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole() {
    return useContext(RoleContext);
}
