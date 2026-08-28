const express = require('express');
const { dbAsync } = require('../config/database');
const { generateContentManually } = require('../jobs/contentGenerator');
const router = express.Router();

// Middleware to check authentication
const isAuthenticated = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Get all templates for current user
router.get('/templates', isAuthenticated, async (req, res) => {
  try {
    const templates = await dbAsync.all(
      'SELECT * FROM templates WHERE userId = ? ORDER BY updatedAt DESC',
      [req.user.id]
    );
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single template
router.get('/templates/:id', isAuthenticated, async (req, res) => {
  try {
    const template = await dbAsync.get(
      'SELECT * FROM templates WHERE id = ? AND userId = ?',
      [req.params.id, req.user.id]
    );

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new template
router.post('/templates', isAuthenticated, async (req, res) => {
  try {
    const { title, topic, prompt, style = 'informative', wordCount = 500 } = req.body;

    if (!title || !topic || !prompt) {
      return res.status(400).json({ error: 'Title, topic, and prompt are required' });
    }

    const result = await dbAsync.run(
      `INSERT INTO templates (userId, title, topic, prompt, style, wordCount)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, title, topic, prompt, style, wordCount]
    );

    res.status(201).json({
      id: result.id,
      message: 'Template created successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update template
router.put('/templates/:id', isAuthenticated, async (req, res) => {
  try {
    const template = await dbAsync.get(
      'SELECT * FROM templates WHERE id = ? AND userId = ?',
      [req.params.id, req.user.id]
    );

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const { title, topic, prompt, style, wordCount, active } = req.body;

    await dbAsync.run(
      `UPDATE templates
       SET title = ?, topic = ?, prompt = ?, style = ?, wordCount = ?, active = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [title || template.title, topic || template.topic, prompt || template.prompt,
       style !== undefined ? style : template.style, wordCount || template.wordCount,
       active !== undefined ? active : template.active, req.params.id]
    );

    res.json({ message: 'Template updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete template
router.delete('/templates/:id', isAuthenticated, async (req, res) => {
  try {
    const template = await dbAsync.get(
      'SELECT * FROM templates WHERE id = ? AND userId = ?',
      [req.params.id, req.user.id]
    );

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await dbAsync.run('DELETE FROM templates WHERE id = ?', [req.params.id]);

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate content manually for a template
router.post('/templates/:id/generate', isAuthenticated, async (req, res) => {
  try {
    const template = await dbAsync.get(
      'SELECT * FROM templates WHERE id = ? AND userId = ?',
      [req.params.id, req.user.id]
    );

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const result = await generateContentManually(req.params.id);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get generated content
router.get('/content/generated', isAuthenticated, async (req, res) => {
  try {
    const content = await dbAsync.all(
      `SELECT gc.*, t.title as templateTitle
       FROM generated_content gc
       JOIN templates t ON gc.templateId = t.id
       WHERE gc.userId = ?
       ORDER BY gc.generatedAt DESC
       LIMIT 50`,
      [req.user.id]
    );

    res.json(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single generated content
router.get('/content/:id', isAuthenticated, async (req, res) => {
  try {
    const content = await dbAsync.get(
      'SELECT * FROM generated_content WHERE id = ? AND userId = ?',
      [req.params.id, req.user.id]
    );

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    res.json(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
