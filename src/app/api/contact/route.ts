import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const RECIPIENT = 'brad_alchin@hotmail.com';

export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
  }

  let name: string, email: string, message: string;
  try {
    ({ name, email, message } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: 'FQ Fixtures Bug Report <onboarding@resend.dev>',
    to: RECIPIENT,
    replyTo: email?.trim() || undefined,
    subject: 'Bug Report – FQ Darling Downs Fixtures',
    text: [
      `Name: ${name?.trim() || 'Not provided'}`,
      `Email: ${email?.trim() || 'Not provided'}`,
      '',
      message.trim(),
    ].join('\n'),
  });

  if (error) {
    console.error('Resend error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
