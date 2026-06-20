import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureAppSchema } from "@/lib/ensureAppSchema";
import { getUserDeactivationStatusByClerkId } from "@/lib/userDeactivation";
import { OnboardingPage as OnboardingClient } from "./OnboardingClient";

export const metadata = { title: "Onboarding | FitCoach Pro" };

export default async function OnboardingServerPage() {
    await ensureAppSchema();
    const { userId } = await auth();
    if (!userId) {
        redirect("/sign-in");
    }

    const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { onboardingDone: true },
    });

    if (await getUserDeactivationStatusByClerkId(userId)) {
        redirect("/deactivated");
    }

    if (user?.onboardingDone) {
        redirect("/dashboard");
    }

    return <OnboardingClient />;
}
