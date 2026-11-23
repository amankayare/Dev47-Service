export function buildWriterWelcomeEmailHtml(params: {
  username: string;
  frontendUrl?: string;
  editorUrl?: string;
}): string {
  const frontendUrl = (params.frontendUrl || "https://amankayare.com").replace(/\/+$/, "");
  const editorUrl = params.editorUrl || `${frontendUrl}/writer/blogs/new`;
  const loginUrl = `${frontendUrl}/login`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to the Dev47 Writing Team</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #111827; border: 1px solid #1f2937; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
          <!-- Top Cyberpunk Accent Bar -->
          <tr>
            <td height="5" style="background: linear-gradient(90deg, #06b6d4, #6366f1, #a855f7);"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 40px 36px 20px 36px; text-align: center;">
              <div style="display: inline-block; padding: 16px; background: rgba(6, 182, 212, 0.12); border: 1px solid rgba(6, 182, 212, 0.25); border-radius: 20px; margin-bottom: 24px;">
                <span style="font-size: 36px;">✍️</span>
              </div>
              <div>
                <span style="display: inline-block; padding: 4px 12px; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 9999px; font-size: 11px; font-weight: 800; color: #818cf8; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px;">
                  Official Author Role
                </span>
              </div>
              <h1 style="margin: 0; font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; line-height: 1.25;">
                Welcome to the Dev47 Writing Team!
              </h1>
              <p style="margin: 12px 0 0 0; font-size: 15px; color: #9ca3af; line-height: 1.5;">
                Congratulations, <strong style="color: #06b6d4;">${params.username}</strong>! You have been granted blog author privileges.
              </p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 10px 36px 30px 36px;">
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #d1d5db; line-height: 1.6;">
                The Dev47 administration team has elevated your account to <strong style="color: #67e8f9;">Blog Writer</strong>. You can now compose, preview, and publish technical articles directly to the realm.
              </p>

              <!-- Features Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: rgba(17, 24, 39, 0.8); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; margin: 24px 0; padding: 20px;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 14px 0; font-size: 13px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">
                      🚀 What You Can Do Now:
                    </h3>
                    <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #9ca3af; line-height: 1.8;">
                      <li><strong style="color: #e5e7eb;">Markdown & Rich HTML:</strong> Write with live syntax highlighting and interactive previews.</li>
                      <li><strong style="color: #e5e7eb;">Cover Media & Quick Links:</strong> Attach high-resolution cover graphics and anchor navigation.</li>
                      <li><strong style="color: #e5e7eb;">Author Attribution:</strong> Every article displays your author card, bio, and portfolio link.</li>
                      <li><strong style="color: #e5e7eb;">Direct Publication:</strong> Publish to the global Dev47 feed for developers worldwide.</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 32px 0 20px 0;">
                <tr>
                  <td align="center">
                    <a href="${editorUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #6366f1 100%); color: #ffffff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 15px 36px; border-radius: 14px; box-shadow: 0 8px 24px rgba(6, 182, 212, 0.35); text-transform: uppercase; letter-spacing: 1px;">
                      Start Writing Your First Post →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 8px 0; font-size: 13px; color: #6b7280; text-align: center; line-height: 1.5;">
                If you are not currently signed in, please <a href="${loginUrl}" style="color: #06b6d4; text-decoration: underline;">log in here</a> first.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px; background-color: #0d1322; border-top: 1px solid #1f2937; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
                Dev47 Platform · High-Signal Engineering & Architecture
              </p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #4b5563;">
                This transactional email was sent to notify you of an account permission update.
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
