import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - auth (auth routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/auth (NextAuth API routes)
     */
    '/((?!auth|_next/static|_next/image|favicon.ico|api/auth).*)',
  ],
}; 

// Define middleware using withAuth HOC for default protection
export default withAuth(
  async function middleware(req: NextRequest) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const { pathname } = req.nextUrl;
    console.log("[Middleware Debug] Path:", pathname, "Token:", token ? JSON.stringify(token, null, 2) : null);

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

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/auth/signin',
      error: '/auth/error',
    },
  }
); 