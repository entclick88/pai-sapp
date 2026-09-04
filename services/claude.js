async function generateContent(template) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('Missing ANTHROPIC_API_KEY in environment');
      return {
        success: false,
        error: 'API key not configured'
      };
    }

    const systemPrompt = `You are a creative content creator specializing in ${template.style} writing style.
Your task is to create engaging and informative content.
Write around ${template.wordCount} words.
Make the content well-structured with clear paragraphs.`;

    const userPrompt = `Create a ${template.type} about: "${template.topic}"

Please create engaging and informative content about this topic. Make it interesting, clear, and suitable for learning.`;

    const response = await fetch('https://openrouter.ai/api/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000'
      },
      body: JSON.stringify({
        model: 'openrouter/auto',
        max_tokens: Math.min(template.wordCount * 2, 4000),
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenRouter API Error:', JSON.stringify(data));
      return {
        success: false,
        error: data.error?.message || 'API Error'
      };
    }

    // Find the text content (filter out thinking blocks)
    const textContent = data.content?.find(block => block.type === 'text');

    if (textContent && textContent.text) {
      return {
        success: true,
        content: textContent.text,
        usage: {
          input_tokens: data.usage?.prompt_tokens || 0,
          output_tokens: data.usage?.completion_tokens || 0
        }
      };
    }

    return {
      success: false,
      error: 'Unexpected response format from OpenRouter API'
    };
  } catch (error) {
    console.error('Generate Content Error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

async function generateTitle(topic) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ANTHROPIC_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000'
      },
      body: JSON.stringify({
        model: 'openrouter/auto',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: `Generate 5 catchy titles for this topic: "${topic}". List them numbered 1-5.`
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenRouter API Error:', JSON.stringify(data));
      return {
        success: false,
        error: data.error?.message || 'API Error'
      };
    }

    if (data.content && data.content[0] && data.content[0].type === 'text') {
      return {
        success: true,
        titles: data.content[0].text
      };
    }

    return {
      success: false,
      error: 'Unexpected response format'
    };
  } catch (error) {
    console.error('Generate Title Error:', error.message);
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
