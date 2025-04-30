export { default } from "next-auth/middleware"

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/(erp)/:path*', // Protect routes under the (erp) group
    // Add other protected routes here
  ],
}; 