// app/api/test-email/route.ts
import config from '@payload-config';
import { getPayload } from 'payload';

const YOUR_DOMAIN = 'yourdomain.com';

export async function GET() {
  const payload = await getPayload({ config })
  
  try {
    const result = await payload.sendEmail({
      from: `noreply@${YOUR_DOMAIN}`, // Simple
      replyTo: `hello@${YOUR_DOMAIN}`, // User can answer
      to: `info@${YOUR_DOMAIN}`, // required
      cc: `cc@${YOUR_DOMAIN}`, // cc required by brevo
      bcc: `bcc@${YOUR_DOMAIN}`, // bcc required by brevo
      subject: 'Welcome to your Payload E-Commerce Template',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #4F46E5;">Your Payload E-Commerce Template is live!</h1>
          <p>Your Brevo email integration is working perfectly.</p>
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
          <p style="color: #6B7280; font-size: 14px;">
            <strong>Sent:</strong> ${new Date().toLocaleString('de-DE')}<br>
            <strong>From:</strong> noreply@${YOUR_DOMAIN}<br>
            <strong>Via:</strong> Brevo Email Service
          </p>
        </div>
      `,
      text: 'Welcome to your Payload E-Commerce Template! Your email setup is working.'
    })

    return Response.json({ 
      success: true,
      message: 'Email successfully sent!',
      messageId: (result as { messageId: string }).messageId,
      timestamp: new Date().toISOString()
    })
  } catch (error: unknown) {
    console.error('Email error:', error)
    const message = error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unknown error'
    return Response.json({ 
      success: false,
      error: message 
    }, { status: 500 })
  }
}