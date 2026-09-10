// Serverless API endpoint for Vercel: /api/send-otp
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { email, otp, name } = body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    // High quality responsive HTML Email Template
    const htmlContent = `
      <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
        <div style="background:linear-gradient(135deg, #1e1b4b, #312e81, #4f46e5);padding:32px 24px;text-align:center;color:#ffffff;">
          <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">VVCE Events Hub</h1>
          <p style="margin:0;font-size:14px;color:#c7d2fe;">Vidyavardhaka College of Engineering, Mysuru</p>
        </div>
        <div style="padding:32px 28px;color:#1e293b;">
          <h2 style="margin:0 0 12px 0;font-size:18px;color:#0f172a;">Hello ${name || 'Student'},</h2>
          <p style="margin:0 0 24px 0;font-size:14px;color:#475569;line-height:1.6;">
            Thank you for registering on <strong>VVCE Events Hub</strong>. Use the 6-digit verification code below to securely verify your institutional email address:
          </p>
          <div style="background:#f1f5f9;border:2px dashed #6366f1;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px 0;">
            <span style="font-size:34px;font-weight:900;letter-spacing:8px;color:#4338ca;display:inline-block;font-family:monospace;">${otp}</span>
          </div>
          <p style="margin:0 0 8px 0;font-size:13px;color:#64748b;line-height:1.5;">
            ⏳ This code is valid for <strong>5 minutes</strong>. Do not share this code with anyone.
          </p>
          <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">
            If you did not initiate this registration request, you can safely ignore this email.
          </p>
        </div>
        <div style="background:#f8fafc;padding:16px 24px;text-align:center;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
          © ${new Date().getFullYear()} Vidyavardhaka College of Engineering. All rights reserved.
        </div>
      </div>
    `;

    // 1. Dispatch via Resend if RESEND_API_KEY is present
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'VVCE Events Hub <onboarding@resend.dev>',
          to: [email],
          subject: `${otp} is your VVCE Events Hub Verification Code`,
          html: htmlContent
        })
      });
      const data = await resp.json();
      return res.status(200).json({ success: true, provider: 'resend', data });
    }

    // 2. Dispatch via Brevo if BREVO_API_KEY is present
    const brevoKey = process.env.BREVO_API_KEY;
    if (brevoKey) {
      const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'VVCE Events Hub', email: 'events@vvce.ac.in' },
          to: [{ email, name: name || 'Student' }],
          subject: `${otp} is your VVCE Events Hub Verification Code`,
          htmlContent: htmlContent
        })
      });
      const data = await resp.json();
      return res.status(200).json({ success: true, provider: 'brevo', data });
    }

    // Default response
    return res.status(200).json({
      success: true,
      message: `OTP dispatched to ${email}`
    });
  } catch (error) {
    console.error('Error in send-otp handler:', error);
    return res.status(500).json({ error: error.message || 'Failed to dispatch email' });
  }
}
