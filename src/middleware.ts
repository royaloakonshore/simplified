import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/(erp)/:path*', // Protect routes under the (erp) group
    '/', // Add root path to potentially redirect
    // Add other protected routes here
  ],
}; 

// Define middleware using withAuth HOC for default protection
export default withAuth(
  async function middleware(req: NextRequest) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const { pathname } = req.nextUrl;

    // If user is authenticated and at the root path, redirect to dashboard
    if (token && pathname === '/') {
      const dashboardUrl = new URL('/dashboard', req.url);
      return NextResponse.redirect(dashboardUrl);
    }

    // If not the root path or user is not authenticated, let withAuth handle default protection based on matcher
    return NextResponse.next();
  },
  {
    callbacks: {
      // This authorized callback runs *before* the main middleware function above
      // It ensures the user is authenticated for routes matched by `config.matcher`
      // If it returns false, the user is redirected to the sign-in page.
      authorized: ({ token }) => !!token,
    },
     pages: {
       signIn: '/auth/signin',
       error: '/auth/error',
       // Add other custom pages if needed
     },
  }
); 