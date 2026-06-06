const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../config/logger');

function getClient() {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

// Scores a blog article's sentiment about a product on a 0–5 scale.
// Input: { productName, articleText } — Output: { score: 0–5|null, summary }
const PROMPT = (productName, text) => `You are analysing a Pakistani tech/product blog article to rate how positively it reviews a specific product.

Product: "${productName}"

Article text:
"""
${text.slice(0, 6000)}
"""

Return ONLY a JSON object (no markdown, no prose):
{
  "score": number 0.0–5.0 — overall sentiment toward the product (5 = highly positive, 0 = highly negative, 2.5 = neutral/mixed). Use null if the article does not actually discuss this product.
  "summary": one-sentence English summary of the article's verdict (max 140 chars)
}`;

async function scoreBlogSentiment(productName, articleText) {
  if (!articleText || articleText.trim().length < 50) {
    return { score: null, summary: '' };
  }

  try {
    const model = getClient().getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(PROMPT(productName, articleText));
    const raw = result.response.text().trim();
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(cleaned);

    let score = parsed.score;
    if (typeof score === 'number') {
      score = Math.max(0, Math.min(5, score)); // clamp 0–5
    } else {
      score = null;
    }

    return { score, summary: (parsed.summary || '').slice(0, 140) };
  } catch (err) {
    logger.error(`[Sentiment] Gemini error: ${err.message}`);
    return { score: null, summary: '' };
  }
}

module.exports = { scoreBlogSentiment };
