import { HERITAGE_BUSINESS } from '../config/heritageBusiness';

export const sendEmail = async (options: { to: string, subject?: string, html?: string, type?: 'commission' | 'questionnaire', clientName?: string }) => {
  const subjects = {
    commission: 'Heritage Artifact Commission - Payment Received',
    questionnaire: 'Heritage Artifact Questionnaire - Received & Research Commencing'
  };

  const templates = {
    commission: `
      <div style="font-family: serif; color: #3d2b1f; padding: 20px;">
        <h2 style="text-transform: uppercase; letter-spacing: 2px;">Thank You, ${options.clientName}</h2>
        <p>We have successfully received your commission and payment confirmation for a Heritage Artifact.</p>
        <p>Your project is now officially in our queue. Please ensure you have completed the online questionnaire to avoid any delays in research.</p>
        <p>We look forward to uncovering your family's unique narrative.</p>
        <br />
        <p>Best regards,</p>
        <p><strong>${HERITAGE_BUSINESS.owner.name}</strong><br />${HERITAGE_BUSINESS.branding.name}</p>
      </div>
    `,
    questionnaire: `
      <div style="font-family: serif; color: #3d2b1f; padding: 20px;">
        <h2 style="text-transform: uppercase; letter-spacing: 2px;">Questionnaire Received</h2>
        <p>Dear ${options.clientName},</p>
        <p>We have received your detailed Heritage Questionnaire. Thank you for providing these vital family narratives.</p>
        <p>Our research team (led by ${HERITAGE_BUSINESS.owner.name}) will now begin the process of verifying lineages and compiling your custom artifact. We aim to have a first draft ready for your review within 7 to 10 working days.</p>
        <p>We will contact you if any further clarification is needed during the research phase.</p>
        <br />
        <p>Best regards,</p>
        <p><strong>${HERITAGE_BUSINESS.owner.name}</strong><br />${HERITAGE_BUSINESS.branding.name}</p>
      </div>
    `
  };

  const finalSubject = options.type ? subjects[options.type] : options.subject;
  const finalHtml = options.type ? templates[options.type] : options.html;

  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: options.to,
        subject: finalSubject,
        html: finalHtml
      })
    });
    return await response.json();
  } catch (error) {
    console.error('Email failed to send:', error);
    return null;
  }
};
