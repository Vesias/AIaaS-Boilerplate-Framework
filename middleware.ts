import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/settings(.*)',
  '/profile(.*)',
  '/api/protected(.*)'
])

const isPublicRoute = createRouteMatcher([
  '/',
  '/about',
  '/contact',
  '/pricing',
  '/blog(.*)',
  '/waitlist',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/waitlist',
  '/api/preview',
  '/api/health',
  '/api/revalidate'
])

const isApiRoute = createRouteMatcher(['/api(.*)'])

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims, orgId } = await auth()
  
  // Allow public routes
  if (isPublicRoute(req)) {
    return
  }
  
  // Protect routes that require authentication
  if (!userId && isProtectedRoute(req)) {
    return auth().redirectToSignIn()
  }
  
  // Check subscription status for dashboard access
  if (userId && req.nextUrl.pathname.startsWith('/dashboard')) {
    const hasActiveSubscription = sessionClaims?.publicMetadata?.subscription?.status === 'active'
    const isWaitlistApproved = sessionClaims?.publicMetadata?.waitlistApproved === true
    
    // If waitlist is enabled and user is not approved, redirect to waitlist
    if (process.env.ENABLE_WAITLIST === 'true' && !isWaitlistApproved) {
      return NextResponse.redirect(new URL('/waitlist', req.url))
    }
    
    // If no active subscription and not waitlist approved, redirect to pricing
    if (!hasActiveSubscription && !isWaitlistApproved) {
      return NextResponse.redirect(new URL('/pricing', req.url))
    }
  }
  
  // Add user context to API routes
  if (isApiRoute(req) && userId) {
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-user-id', userId)
    requestHeaders.set('x-org-id', orgId || '')
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      }
    })
  }
  
  // Protect all other routes by default
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}