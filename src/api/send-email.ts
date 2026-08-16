import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, html, type } = req.body;

  try {
    // In Resend sandbox mode (no verified domain), you can only send to yourself.
    // We'll try to send to the requested 'to' address, but if it's not verified,
    // Resend will return an error. We'll handle that by ensuring at least the 
    // admin (tomknsn@gmail.com) gets the notification.
    
    const data = await resend.emails.send({
      from: 'Heritage Artifacts <onboarding@resend.dev>',
      to: [to],
      cc: ['tomknsn@gmail.com'],
      subject: subject,
      html: html,
    });

    if ((data as any).error) {
      console.error('Resend API Error:', (data as any).error);
      // If it failed but we are in sandbox, try sending ONLY to the admin
      const fallbackData = await resend.emails.send({
        from: 'Heritage Artifacts <onboarding@resend.dev>',
        to: ['tomknsn@gmail.com'],
        subject: `[FALLBACK] ${subject} (Original recipient: ${to})`,
        html: `<h3>Note: This is a fallback email because the original recipient (${to}) is not verified in your Resend sandbox.</h3><hr/>${html}`,
      });
      return res.status(200).json({ ...fallbackData, note: 'Sent to admin fallback' });
    }

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Email caught error:', error);
    // Try one last time to just the admin
    try {
      await resend.emails.send({
        from: 'Heritage Artifacts <onboarding@resend.dev>',
        to: ['tomknsn@gmail.com'],
        subject: `[ERROR FALLBACK] ${subject}`,
        html: `<h3>An error occurred while sending to ${to}.</h3><p>Error: ${error.message}</p><hr/>${html}`,
      });
    } catch (e) {
      console.error('Final fallback failed:', e);
    }
    return res.status(500).json({ error: error.message || 'Unknown error' });
  }
}
