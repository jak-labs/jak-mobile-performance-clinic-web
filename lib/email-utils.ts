/**
 * Utility functions for sending emails with calendar attachments
 */

/**
 * Create a multipart MIME email with calendar attachment
 */
export function createMultipartEmail(
  from: string,
  to: string,
  subject: string,
  htmlBody: string,
  textBody: string,
  icsContent: string,
  icsFilename: string = 'invite.ics'
): Buffer {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const icsBase64 = Buffer.from(icsContent).toString('base64');

  const emailParts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    textBody,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    htmlBody,
    ``,
    `--${boundary}`,
    `Content-Type: text/calendar; charset=UTF-8; method=REQUEST`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${icsFilename}"`,
    ``,
    icsBase64,
    ``,
    `--${boundary}--`,
  ];

  return Buffer.from(emailParts.join('\r\n'));
}

