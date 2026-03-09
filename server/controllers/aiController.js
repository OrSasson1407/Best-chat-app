// server/controllers/aiController.js
const { OpenAI } = require("openai");

// Initialize OpenAI (Make sure to add OPENAI_API_KEY to your .env file)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports.generateQuickReplies = async (req, res, next) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
        return res.json({ status: false, msg: "Invalid message format" });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Fast and cheap for quick tasks
      messages: [
        { 
            role: "system", 
            content: "You are a helpful chat assistant. The user just received the following message. Generate exactly 3 short, casual, and contextual quick replies they could send back. Return ONLY a valid JSON array of 3 strings. Example: [\"Sounds good!\", \"I'll check it out.\", \"Thanks!\"]" 
        },
        { 
            role: "user", 
            content: message 
        }
      ],
      temperature: 0.7,
    });

    const repliesText = response.choices[0].message.content;
    const replies = JSON.parse(repliesText);

    return res.status(200).json({ status: true, replies });
  } catch (error) {
    console.error("AI Quick Reply Error:", error);
    return res.status(500).json({ status: false, msg: "Failed to generate replies" });
  }
};

module.exports.translateMessage = async (req, res, next) => {
  try {
    const { message, targetLanguage } = req.body;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { 
            role: "system", 
            content: `Translate the following text to ${targetLanguage}. Return ONLY the translated text, nothing else.` 
        },
        { 
            role: "user", 
            content: message 
        }
      ],
      temperature: 0.3,
    });

    const translatedText = response.choices[0].message.content.trim();

    return res.status(200).json({ status: true, translatedText });
  } catch (error) {
    console.error("AI Translation Error:", error);
    return res.status(500).json({ status: false, msg: "Failed to translate message" });
  }
};