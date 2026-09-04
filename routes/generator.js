const express = require('express');
const { generateContent } = require('../services/claude');
const router = express.Router();

router.post('/generate', async (req, res) => {
  try {
    const { topic, style = 'informative', type = 'story' } = req.body;

    if (!topic || topic.trim() === '') {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const systemPrompt = `You are a creative content creator. You write ${style} content in ${type} format.
Create engaging, well-structured, and easy-to-understand content suitable for students.
Use clear language and make it interesting to read.`;

    const userPrompt = `Create a ${type} about: "${topic}"

Please create engaging and informative content about this topic. Make it interesting, clear, and suitable for learning.`;

    const template = {
      style,
      wordCount: 500,
      topic,
      prompt: userPrompt
    };

    const result = await generateContent(template);

    if (result.success) {
      res.json({
        success: true,
        content: result.content,
        usage: result.usage
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Generation Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
