export function buildDoubleOptInConfirmationHtml(params: {
  confirmationUrl: string;
  unsubscribeUrl: string;
  email: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Your Subscription</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #111827; border: 1px solid #1f2937; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Top Accent Bar -->
          <tr>
            <td height="4" style="background: linear-gradient(90deg, #06b6d4, #6366f1, #a855f7);"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 40px 36px 20px 36px; text-align: center;">
              <div style="display: inline-block; padding: 12px; background: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.2); border-radius: 16px; margin-bottom: 20px;">
                <span style="font-size: 28px;">📬</span>
              </div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                Confirm Your Subscription
              </h1>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #9ca3af; line-height: 1.5;">
                Dev47 Future Insights Newsletter
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 10px 36px 30px 36px;">
              <p style="margin: 0 0 18px 0; font-size: 15px; color: #d1d5db; line-height: 1.6;">
                Thank you for your interest! Please click the button below to confirm that you want to receive high-signal articles on modern web architecture, cloud engineering, and AI integration.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${params.confirmationUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 34px; border-radius: 12px; box-shadow: 0 4px 14px rgba(6, 182, 212, 0.35);">
                      Confirm My Subscription →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 10px 0; font-size: 13px; color: #6b7280; line-height: 1.5;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0; font-size: 12px; color: #06b6d4; word-break: break-all; line-height: 1.4;">
                <a href="${params.confirmationUrl}" style="color: #06b6d4; text-decoration: underline;">${params.confirmationUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 36px;">
              <div style="height: 1px; background-color: #1f2937;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #6b7280;">
                If you did not make this request, you can safely ignore this email. You won't be subscribed.
              </p>
              <p style="margin: 0; font-size: 11px; color: #4b5563;">
                © ${new Date().getFullYear()} Aman Kayare · Dev47 · <a href="${params.unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Opt out</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildWelcomeSubscriberHtml(params: {
  unsubscribeUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Dev47 Insights</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #111827; border: 1px solid #1f2937; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <tr>
            <td height="4" style="background: linear-gradient(90deg, #10b981, #06b6d4, #6366f1);"></td>
          </tr>
          <tr>
            <td style="padding: 40px 36px 20px 36px; text-align: center;">
              <div style="display: inline-block; padding: 12px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 16px; margin-bottom: 20px;">
                <span style="font-size: 28px;">🎉</span>
              </div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                You're In! Welcome to Dev47.
              </h1>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #9ca3af; line-height: 1.5;">
                Your subscription is now active.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 36px 30px 36px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #d1d5db; line-height: 1.6;">
                You'll receive exclusive, in-depth breakdowns on full-stack architecture, microservices, cloud deployments, and modern UI engineering.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
                <tr>
                  <td align="center">
                    <a href="https://amankayare.com/blogs" target="_blank" style="display: inline-block; background: #ffffff; color: #111827; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 34px; border-radius: 12px; box-shadow: 0 4px 14px rgba(255, 255, 255, 0.2);">
                      Explore Recent Articles →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 36px;">
              <div style="height: 1px; background-color: #1f2937;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 36px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #4b5563;">
                © ${new Date().getFullYear()} Aman Kayare · Dev47 · <a href="${params.unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a> anytime with one click.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
