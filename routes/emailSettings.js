const express = require('express');
const { dbAsync } = require('../config/database');
const router = express.Router();

// Middleware to check authentication
const isAuthenticated = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Get email settings
router.get('/email-settings', isAuthenticated, async (req, res) => {
  try {
    let settings = await dbAsync.get(
      'SELECT * FROM email_settings WHERE userId = ?',
      [req.user.id]
    );

    if (!settings) {
      // Create default settings if not exists
      await dbAsync.run(
        `INSERT INTO email_settings (userId, recipientEmails)
         VALUES (?, ?)`,
        [req.user.id, req.user.email]
      );

      settings = await dbAsync.get(
        'SELECT * FROM email_settings WHERE userId = ?',
        [req.user.id]
      );
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update email settings
router.put('/email-settings', isAuthenticated, async (req, res) => {
  try {
    const { recipientEmails, includeContentLink, emailTemplate } = req.body;

    if (!recipientEmails) {
      return res.status(400).json({ error: 'Recipient emails are required' });
    }

    // Check if settings exists
    let settings = await dbAsync.get(
      'SELECT * FROM email_settings WHERE userId = ?',
      [req.user.id]
    );

    if (!settings) {
      // Create new settings
      await dbAsync.run(
        `INSERT INTO email_settings (userId, recipientEmails, includeContentLink, emailTemplate)
         VALUES (?, ?, ?, ?)`,
        [req.user.id, recipientEmails, includeContentLink !== false ? 1 : 0, emailTemplate || 'default']
      );
    } else {
      // Update existing settings
      await dbAsync.run(
        `UPDATE email_settings
         SET recipientEmails = ?, includeContentLink = ?, emailTemplate = ?, updatedAt = datetime('now')
         WHERE userId = ?`,
        [recipientEmails, includeContentLink !== false ? 1 : 0, emailTemplate || 'default', req.user.id]
      );
    }

    res.json({ message: 'Email settings updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test email settings
router.post('/email-settings/test', isAuthenticated, async (req, res) => {
  try {
    const settings = await dbAsync.get(
      'SELECT * FROM email_settings WHERE userId = ?',
      [req.user.id]
    );

    if (!settings) {
      return res.status(404).json({ error: 'Email settings not found' });
    }

    const { sendContentEmail } = require('../services/emailer');

    const testEmail = settings.recipientEmails.split(',')[0].trim();

    const result = await sendContentEmail(
      testEmail,
      'Test Email from Content Generator',
      'This is a test email to verify your email configuration is working correctly. If you received this, everything is set up properly!',
      'Test Email - Content Generator'
    );

    if (result.success) {
      res.json({
        success: true,
        message: `Test email sent to ${testEmail}`,
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
