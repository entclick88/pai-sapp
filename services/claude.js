const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function generateContent(template) {
  try {
    const systemPrompt = `You are a professional content writer specializing in ${template.style} writing style.
Your task is to create engaging and informative blog posts.
Write exactly around ${template.wordCount} words.
Make the content SEO-friendly and well-structured with proper headings.`;

    const userPrompt = `${template.prompt}

Topic: ${template.topic}

Please write a blog post about this topic. Make it engaging, informative, and well-structured.`;

    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: Math.min(template.wordCount * 2, 4000),
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ],
      system: systemPrompt
    });

    if (message.content[0].type === 'text') {
      return {
        success: true,
        content: message.content[0].text,
        usage: {
          input_tokens: message.usage.input_tokens,
          output_tokens: message.usage.output_tokens
        }
      };
    }

    return {
      success: false,
      error: 'Unexpected response format from Claude API'
    };
  } catch (error) {
    console.error('Claude API Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function generateTitle(topic) {
  try {
    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Generate 5 catchy and SEO-friendly blog post titles for this topic: "${topic}". List them numbered 1-5.`
        }
      ]
    });

    if (message.content[0].type === 'text') {
      return {
        success: true,
        titles: message.content[0].text
      };
    }
  } catch (error) {
    console.error('Claude Title Generation Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  generateContent,
  generateTitle
};
