import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export default clerkMiddleware(async (auth, req) => {
    const { userId } = await auth();
    const wantsLanding = req.nextUrl.pathname === '/' && req.nextUrl.searchParams.get('view') === 'landing';

    // If signed in, route through onboarding first. Completed users are redirected
    // from /onboarding to the dashboard by the server page.
    if (userId && ((req.nextUrl.pathname === '/' && !wantsLanding) || req.nextUrl.pathname === '/sign-up' || req.nextUrl.pathname === '/sign-in')) {
        return NextResponse.redirect(new URL('/onboarding', req.url));
    }
})

export const config = {
    matcher: [
        '/((?!_next|api/upload|api/uploads|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        '/(api(?!/upload|/uploads)|trpc)(.*)',
    ],
}
