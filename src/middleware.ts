import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - auth (auth routes)
     * - bootstrap (bootstrap routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/auth (NextAuth API routes)
     * - api/bootstrap (bootstrap API routes)
     */
    '/((?!auth|bootstrap|_next/static|_next/image|favicon.ico|api/auth|api/bootstrap).*)',
  ],
}; 

export default async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;
  
  // Only log middleware debug in development if MIDDLEWARE_DEBUG is enabled
  if (process.env.NODE_ENV === 'development' && process.env.MIDDLEWARE_DEBUG === 'true') {
    console.log("[Middleware Debug] Path:", pathname, "Token:", token ? "Present" : "Missing");
  }

  // If user is authenticated and at the root path, redirect to dashboard
  if (token && pathname === '/') {
    const dashboardUrl = new URL('/dashboard', req.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // If user is not authenticated and trying to access protected routes, redirect to signin
  if (!token && pathname !== '/auth/signin') {
    const signInUrl = new URL('/auth/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // For authenticated users, allow the request to proceed
  if (token) {
    return NextResponse.next();
  }

  // For unauthenticated users, redirect to signin
  const signInUrl = new URL('/auth/signin', req.url);
  signInUrl.searchParams.set('callbackUrl', pathname);
  return NextResponse.redirect(signInUrl);
} 