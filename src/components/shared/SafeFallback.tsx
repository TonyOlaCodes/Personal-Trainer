import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";

export function SafeFallback({ title, errorDetails }: { title: string, errorDetails?: string }) {
    return (
        <div className="min-h-screen bg-surface-base flex items-center justify-center p-6">
            <div className="card p-10 max-w-md text-center space-y-4">
                <AlertTriangle className="w-12 h-12 text-warning mx-auto" />
                <h2 className="text-xl font-black text-fg">{title} Unavailable</h2>
                <p className="text-sm text-fg-muted">
                    We couldn&apos;t load your data right now. This might be a temporary issue. Please try again.
                </p>
                {errorDetails && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-left overflow-auto max-h-48">
                        <p className="text-xs font-mono text-red-400 whitespace-pre-wrap">{errorDetails}</p>
                    </div>
                )}
                <Link href="/dashboard" className="btn-primary inline-block">
                    Back to Dashboard
                </Link>
            </div>
        </div>
    );
}

export function isNextInternalError(err: any): boolean {
    if (!err) return false;
    
    // unstable_rethrow throws Next.js internal errors. We don't catch it so it bubbles up.
    if (typeof unstable_rethrow === "function") {
        unstable_rethrow(err);
    }
    
    if (typeof err.digest === "string") {
        if (err.digest.startsWith("NEXT_REDIRECT") || 
            err.digest === "NEXT_NOT_FOUND" || 
            err.digest === "DYNAMIC_SERVER_USAGE") {
            return true;
        }
    }
    
    if (err instanceof Error) {
        if (err.name === "DynamicServerError" || 
            err.message.includes("Dynamic server usage") || 
            err.message.includes("NEXT_REDIRECT") || 
            err.message === "NEXT_NOT_FOUND") {
            return true;
        }
    }
    
    return false;
}
