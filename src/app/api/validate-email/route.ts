import { NextRequest, NextResponse } from 'next/server'
import { checkEmail } from '@/lib/email-check'

export const runtime = 'nodejs'

// Pre-signup check used by the signup form.
export async function POST(request: NextRequest) {
  let email = ''
  try {
    const body = await request.json()
    email = typeof body?.email === 'string' ? body.email : ''
  } catch {
    return NextResponse.json({ ok: false, message: 'Please enter a valid email address.' }, { status: 400 })
  }
  if (email.length > 320) {
    return NextResponse.json({ ok: false, message: 'Please enter a valid email address.' }, { status: 400 })
  }
  const result = await checkEmail(email)
  return NextResponse.json(result, { status: result.ok ? 200 : 422 })
}
