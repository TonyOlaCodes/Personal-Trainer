import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export default clerkMiddleware(async (auth, req) => {
    const { userId } = await auth();

    // If signed in, skip the landing page and go straight to the dashboard
    if (userId && req.nextUrl.pathname === '/') {
        return NextResponse.redirect(new URL('/dashboard', req.url));
    }
})

export const config = {
    matcher: [
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        '/(api|trpc)(.*)',
    ],
}
