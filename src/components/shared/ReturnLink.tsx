"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useHrefWithReturn } from "@/hooks/useNavigation";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
    href: string;
};

/** Link that preserves the current page as the back destination. */
export function ReturnLink({ href, ...props }: Props) {
    const hrefWithReturn = useHrefWithReturn(href);
    return <Link href={hrefWithReturn} {...props} />;
}
