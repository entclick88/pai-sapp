const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

async function sendContentEmail(recipientEmail, contentTitle, contentBody, subject) {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          .content { background: #f9f9f9; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
          h1 { margin-top: 0; }
          a { color: #667eea; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📝 New Content Generated</h1>
            <p>Your automated content has been created and is ready to share!</p>
          </div>

          <h2>${contentTitle}</h2>

          <div class="content">
            ${contentBody.replace(/\n/g, '<br>')}
          </div>

          <div class="footer">
            <p>This content was automatically generated using Claude AI.</p>
            <p>Generated at: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: recipientEmail,
      subject: subject || `New Blog Post: ${contentTitle}`,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('Email sent successfully:', info.messageId);
    return {
      success: true,
      messageId: info.messageId,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Email sending error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function sendMultipleEmails(recipientEmails, contentTitle, contentBody, subject) {
  const results = [];

  for (const email of recipientEmails.split(',')) {
    const trimmedEmail = email.trim();
    const result = await sendContentEmail(trimmedEmail, contentTitle, contentBody, subject);
    results.push({ email: trimmedEmail, ...result });
  }

  return results;
}

async function testEmailConnection() {
  try {
    await transporter.verify();
    console.log('Email server is ready to send messages');
    return true;
  } catch (error) {
    console.error('Email server error:', error);
    return false;
  }
}

module.exports = {
  sendContentEmail,
  sendMultipleEmails,
  testEmailConnection
};
