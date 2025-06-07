import { NextResponse } from 'next/server';

export async function POST() {
  // Simply redirect to home page for now, as we have middleware that will handle sessions
  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
} 