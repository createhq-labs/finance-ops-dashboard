import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Public signup is disabled. Contact admin/finance to provision your account.',
    },
    { status: 403 }
  );
}