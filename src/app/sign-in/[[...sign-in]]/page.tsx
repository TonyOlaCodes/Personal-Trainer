import { SignIn } from "@clerk/nextjs";
import { Zap } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/components/shared/BrandLogo";

export default function SignInPage() {
    return (
        <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand-600/8 rounded-full blur-3xl pointer-events-none" />

            <Link href="/" className="flex items-center gap-2.5 mb-8">
                <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-brand">
                    <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-xl tracking-tight">
                    <BrandLogo />
                </span>
            </Link>

            <SignIn fallbackRedirectUrl="/onboarding" />

            <div className="mt-6 flex flex-col items-center gap-3 text-center">
                <Link href="/" className="text-sm font-semibold text-brand-400 hover:text-brand-300 transition-colors">
                    Back to home
                </Link>
                <p className="max-w-sm text-xs text-fg-subtle leading-relaxed">
                    <Link href="/terms" className="text-brand-400 hover:text-brand-300 font-semibold">
                        Terms
                    </Link>
                    {" · "}
                    <Link href="/privacy" className="text-brand-400 hover:text-brand-300 font-semibold">
                        Privacy
                    </Link>
                </p>
            </div>
        </div>
    );
}
