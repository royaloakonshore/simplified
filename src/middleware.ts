export { default } from "next-auth/middleware"

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/(main)/:path*', // Protect routes under the (main) group
    // Add other protected routes here
  ],
}; 