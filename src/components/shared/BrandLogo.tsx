import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export function BrandLogo({
    className,
    suffixClassName,
}: {
    className?: string;
    suffixClassName?: string;
}) {
    return (
        <span className={cn("font-bold tracking-tight", className)}>
            {siteConfig.brandPrefix}
            <span className={cn("text-gradient", suffixClassName)}>{siteConfig.brandSuffix}</span>
        </span>
    );
}
