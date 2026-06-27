import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { PublicProfileClient } from "./PublicProfileClient";
import { ensureAppSchema } from "@/lib/ensureAppSchema";

export const metadata = { title: "Profile" };

export default async function PublicProfilePage({
    params,
}: {
    params: Promise<{ userId: string }>;
}) {
    await ensureAppSchema();
    const { userId: clerkId } = await auth();
    if (!clerkId) redirect("/sign-in");

    const currentUser = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true },
    });
    if (!currentUser) redirect("/sign-in");

    const { userId } = await params;

    return (
        <>
            <TopBar title="Profile" subtitle="Public athlete profile" />
            <div className="p-4 sm:p-6 lg:p-10 max-w-5xl mx-auto">
                <PublicProfileClient userId={userId} currentUserId={currentUser.id} />
            </div>
        </>
    );
}
