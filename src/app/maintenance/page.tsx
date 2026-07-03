import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getMaintenanceMode } from "@/lib/maintenanceMode";
import { siteConfig } from "@/lib/site";

export const metadata = {
    title: "Scheduled Maintenance",
};

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
    const enabled = await getMaintenanceMode();
    if (!enabled) redirect("/");

    const { userId } = await auth();
    if (userId) {
        const user = await prisma.user.findUnique({
            where: { clerkId: userId },
            select: { role: true },
        });
        if (user?.role === "SUPER_ADMIN") redirect("/admin");
    }

    return (
        <main className="min-h-screen bg-surface-base text-fg flex items-center justify-center px-5 py-10">
            <section className="w-full max-w-xl text-center">
                <div className="mx-auto mb-8 inline-flex items-center gap-3 rounded-2xl border border-brand-500/25 bg-brand-500/10 px-5 py-3 shadow-glow-brand-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white font-black shadow-glow-brand">
                        {siteConfig.shortName}
                    </div>
                    <div className="text-left leading-none">
                        <p className="text-lg font-black tracking-tight text-fg">
                            {siteConfig.brandPrefix}
                            <span className="text-brand-400">{siteConfig.brandSuffix}</span>
                        </p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-fg-subtle">
                            {siteConfig.tagline}
                        </p>
                    </div>
                </div>

                <div className="rounded-3xl border border-surface-border bg-surface-card/90 px-6 py-10 shadow-card sm:px-10">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-warning/30 bg-warning/10 text-3xl shadow-glow-warning-sm">
                        🔧
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-fg sm:text-4xl">
                        🔧 Scheduled Maintenance
                    </h1>
                    <p className="mt-5 text-sm leading-7 text-fg-muted sm:text-base">
                        TOLGcoaching is currently undergoing scheduled maintenance to improve the platform. We&apos;ll be back online as soon as possible. Thank you for your patience.
                    </p>
                    <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-brand-400">
                        We&apos;re making improvements to provide a better experience.
                    </p>
                </div>
            </section>
        </main>
    );
}
