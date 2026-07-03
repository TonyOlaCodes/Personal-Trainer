import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

const PUBLIC_DURING_MAINTENANCE = [
    '/maintenance',
    '/sign-in',
    '/sign-up',
    '/privacy',
    '/terms',
    '/robots.txt',
    '/sitemap.xml',
    '/manifest.webmanifest',
];

const PUBLIC_API_DURING_MAINTENANCE = [
    '/api/webhooks/clerk',
];

async function loadMaintenanceAccess(clerkId: string | null) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) return { enabled: false, isAdmin: false };

    try {
        const sql = neon(databaseUrl);
        const [settingRows, userRows] = await Promise.all([
            sql`
                SELECT "value"
                FROM "app_settings"
                WHERE "key" = 'maintenance_mode'
                LIMIT 1
            `,
            clerkId
                ? sql`
                    SELECT "role"
                    FROM "users"
                    WHERE "clerkId" = ${clerkId}
                    LIMIT 1
                `
                : Promise.resolve([]),
        ]);

        return {
            enabled: settingRows[0]?.value === true || settingRows[0]?.value === 'true',
            isAdmin: userRows[0]?.role === 'SUPER_ADMIN',
        };
    } catch {
        return { enabled: false, isAdmin: false };
    }
}

export default clerkMiddleware(async (auth, req) => {
    const { userId } = await auth();
    const pathname = req.nextUrl.pathname;
    const wantsLanding = pathname === '/' && req.nextUrl.searchParams.get('view') === 'landing';
    const isPublicPage = PUBLIC_DURING_MAINTENANCE.some((path) => pathname === path || pathname.startsWith(`${path}/`));
    const isPublicApi = PUBLIC_API_DURING_MAINTENANCE.some((path) => pathname === path || pathname.startsWith(`${path}/`));

    const maintenance = await loadMaintenanceAccess(userId);
    if (maintenance.enabled && !maintenance.isAdmin && !isPublicPage && !isPublicApi) {
        if (pathname.startsWith('/api')) {
            return NextResponse.json(
                { error: 'Scheduled maintenance is active' },
                { status: 503 }
            );
        }
        return NextResponse.redirect(new URL('/maintenance', req.url));
    }

    if (maintenance.isAdmin && pathname === '/maintenance') {
        return NextResponse.redirect(new URL('/admin', req.url));
    }

    // If signed in, route through onboarding first. Completed users are redirected
    // from /onboarding to the dashboard by the server page.
    if (userId && ((pathname === '/' && !wantsLanding) || pathname === '/sign-up' || pathname === '/sign-in')) {
        return NextResponse.redirect(new URL('/onboarding', req.url));
    }
})

export const config = {
    matcher: [
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        '/(api|trpc)(.*)',
    ],
}
