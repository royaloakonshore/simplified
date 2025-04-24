import { NextResponse, type NextRequest } from 'next/server'

// This is a placeholder middleware that will be expanded in future steps
// with proper Supabase auth integration
export async function middleware(request: NextRequest) {
  // For now, we'll just pass through all requests
  return NextResponse.next()
}

// Only run middleware on auth-required routes
export const config = {
  matcher: ['/dashboard/:path*', '/(erp)/:path*'],
} 