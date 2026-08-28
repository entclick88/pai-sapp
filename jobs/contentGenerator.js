const cron = require('node-cron');
const { dbAsync } = require('../config/database');
const { generateContent } = require('../services/claude');
const { sendMultipleEmails } = require('../services/emailer');

let cronJob = null;

function startContentGenerationJob() {
  // Run at 9:00 AM every day (0 9 * * *)
  cronJob = cron.schedule('0 9 * * *', async () => {
    console.log('🤖 Starting scheduled content generation...');
    await runContentGeneration();
  });

  console.log('✅ Content generation job scheduled for 9:00 AM daily');
}

async function runContentGeneration() {
  try {
    // Get all active templates
    const templates = await dbAsync.all(`
      SELECT t.*, u.id as userId, u.email
      FROM templates t
      JOIN users u ON t.userId = u.id
      WHERE t.active = 1
    `);

    if (templates.length === 0) {
      console.log('No active templates found');
      return;
    }

    for (const template of templates) {
      try {
        // Generate content using Claude
        const generationResult = await generateContent(template);

        if (!generationResult.success) {
          console.error(`Failed to generate content for template ${template.id}:`, generationResult.error);
          continue;
        }

        // Extract title from content (first line or first sentence)
        const lines = generationResult.content.split('\n').filter(line => line.trim());
        let titleFromContent = lines[0] || template.topic;

        // Clean up the title if it has markdown
        titleFromContent = titleFromContent.replace(/^#+\s*/, '').trim();

        // Save generated content to database
        const contentResult = await dbAsync.run(
          `INSERT INTO generated_content (userId, templateId, title, content, generatedAt)
           VALUES (?, ?, ?, ?, datetime('now'))`,
          [template.userId, template.id, titleFromContent, generationResult.content]
        );

        // Get email settings
        const emailSettings = await dbAsync.get(
          'SELECT * FROM email_settings WHERE userId = ?',
          [template.userId]
        );

        if (emailSettings && emailSettings.recipientEmails) {
          // Send email
          const emailResult = await sendMultipleEmails(
            emailSettings.recipientEmails,
            titleFromContent,
            generationResult.content,
            `New Blog Post: ${titleFromContent}`
          );

          // Update sent timestamp
          if (emailResult.some(r => r.success)) {
            await dbAsync.run(
              'UPDATE generated_content SET sentAt = datetime("now") WHERE id = ?',
              [contentResult.id]
            );

            console.log(`✅ Content generated and emailed for template ${template.id}`);
            console.log(`   Tokens used - Input: ${generationResult.usage.input_tokens}, Output: ${generationResult.usage.output_tokens}`);
          }
        } else {
          console.log(`⚠️  No email recipients configured for user ${template.userId}`);
        }
      } catch (error) {
        console.error(`Error processing template ${template.id}:`, error);
      }
    }

    console.log('✅ Content generation job completed');
  } catch (error) {
    console.error('Content generation job error:', error);
  }
}

// For manual trigger (testing)
async function generateContentManually(templateId) {
  try {
    console.log(`Manually generating content for template ${templateId}...`);

    const template = await dbAsync.get(`
      SELECT t.*, u.id as userId, u.email
      FROM templates t
      JOIN users u ON t.userId = u.id
      WHERE t.id = ?
    `, [templateId]);

    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    const generationResult = await generateContent(template);

    if (!generationResult.success) {
      return generationResult;
    }

    const lines = generationResult.content.split('\n').filter(line => line.trim());
    let titleFromContent = lines[0] || template.topic;
    titleFromContent = titleFromContent.replace(/^#+\s*/, '').trim();

    const contentResult = await dbAsync.run(
      `INSERT INTO generated_content (userId, templateId, title, content, generatedAt)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [template.userId, template.id, titleFromContent, generationResult.content]
    );

    const emailSettings = await dbAsync.get(
      'SELECT * FROM email_settings WHERE userId = ?',
      [template.userId]
    );

    let emailStatus = 'skipped';
    if (emailSettings && emailSettings.recipientEmails) {
      const emailResult = await sendMultipleEmails(
        emailSettings.recipientEmails,
        titleFromContent,
        generationResult.content,
        `New Blog Post: ${titleFromContent}`
      );

      if (emailResult.some(r => r.success)) {
        await dbAsync.run(
          'UPDATE generated_content SET sentAt = datetime("now") WHERE id = ?',
          [contentResult.id]
        );
        emailStatus = 'sent';
      }
    }

    return {
      success: true,
      contentId: contentResult.id,
      title: titleFromContent,
      emailStatus: emailStatus,
      tokens: generationResult.usage
    };
  } catch (error) {
    console.error('Manual generation error:', error);
    return { success: false, error: error.message };
  }
}

function stopContentGenerationJob() {
  if (cronJob) {
    cronJob.stop();
    console.log('Content generation job stopped');
  }
}

module.exports = {
  startContentGenerationJob,
  generateContentManually,
  stopContentGenerationJob,
  runContentGeneration
};
