// server/controllers/aiController.js
const { OpenAI } = require("openai");
const Message = require("../models/Message");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy-key", // Fallback to prevent init crash
});

// Helper — returns true if a usable API key is configured
const hasApiKey = () => {
  const key = process.env.OPENAI_API_KEY;
  return (
    key &&
    !key.includes("dummy-key") &&
    !key.includes("REPLACE_THIS") // Added check for your local .env placeholder
  );
};

// --- FEATURE 1: Quick Replies ---
module.exports.generateQuickReplies = async (req, res, next) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.json({ status: false, msg: "Invalid message format" });
    }

    // No API key — return empty silently, no 500, no console spam
    if (!hasApiKey()) {
      return res.status(200).json({ status: false, replies: [] });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            'You are a helpful chat assistant. The user just received the following message. Generate exactly 3 short, casual, and contextual quick replies they could send back. Return ONLY a valid JSON array of 3 strings. Example: ["Sounds good!", "I\'ll check it out.", "Thanks!"]',
        },
        { role: "user", content: message },
      ],
      temperature: 0.7,
    });

    const repliesText = response.choices[0].message.content;

    try {
      const replies = JSON.parse(repliesText);
      return res.status(200).json({ status: true, replies });
    } catch (parseErr) {
      // JSON parse failed, send fallbacks
      return res
        .status(200)
        .json({ status: true, replies: ["Sounds good!", "Okay", "Thanks!"] });
    }
  } catch (error) {
    console.error("AI Quick Reply Error (Quota/Key issue):", error.message || error);
    // FIX: Instead of throwing a 500 error that breaks the frontend, 
    // gracefully return a 200 status with generic fallback replies.
    return res
      .status(200)
      .json({ status: true, replies: ["Sounds good!", "Okay", "Thanks!"] });
  }
};

// --- FEATURE 1b: Translate Message ---
module.exports.translateMessage = async (req, res, next) => {
  try {
    const { message, targetLanguage } = req.body;

    if (!hasApiKey()) {
      return res.status(200).json({
        status: false,
        msg: "AI translation is not configured on this server.",
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `Translate the following text to ${targetLanguage}. Return ONLY the translated text, nothing else.`,
        },
        { role: "user", content: message },
      ],
      temperature: 0.3,
    });

    const translatedText = response.choices[0].message.content.trim();
    return res.status(200).json({ status: true, translatedText });
  } catch (error) {
    console.error("AI Translation Error:", error.message || error);
    // Graceful degradation for translation
    return res
      .status(200)
      .json({ status: false, msg: "AI translation currently unavailable." });
  }
};

// --- FEATURE 2: AI Chat Summarizer ---
module.exports.summarizeChat = async (req, res, next) => {
  try {
    const { from, to, limit = 50 } = req.body;

    if (!from || !to) {
      return res
        .status(400)
        .json({ status: false, msg: "Missing chat parameters" });
    }

    if (!hasApiKey()) {
      return res.status(200).json({
        status: false,
        msg: "AI summarization is not configured on this server.",
      });
    }

    const messages = await Message.find({
      users: { $all: [from, to] },
      isDeleted: false,
      type: "text",
    })
      .sort({ _id: -1 })
      .limit(limit)
      .populate("sender", "username");

    if (!messages || messages.length < 5) {
      return res.json({
        status: false,
        msg: "Not enough messages to summarize. Read them yourself! 😉",
      });
    }

    const transcript = messages
      .reverse()
      .map((msg) => {
        const senderName = msg.sender?.username || "Unknown User";
        return `${senderName}: ${msg.message.text}`;
      })
      .join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a smart chat assistant. Summarize the following conversation transcript in exactly 3 short, punchy bullet points. Focus on key decisions, events, or important shared information. Ignore basic greetings.",
        },
        { role: "user", content: `Here is the conversation:\n\n${transcript}` },
      ],
      temperature: 0.5,
    });

    const summary = response.choices[0].message.content.trim();
    return res.status(200).json({ status: true, summary });
  } catch (error) {
    console.error("AI Chat Summary Error:", error.message || error);
    // Graceful degradation for summary
    return res
      .status(200)
      .json({ status: false, msg: "AI summary currently unavailable due to API limits." });
  }
};
// =============================================================
// SPRINT 1 — FEATURE 5: Spell Check & Grammar Correction
// =============================================================
module.exports.grammarCheck = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string" || message.trim().length < 3) {
      return res.json({ status: false, corrected: message });
    }

    if (!hasApiKey()) {
      return res.json({ status: false, corrected: message });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a grammar and spell-check assistant. Fix any spelling or grammar mistakes in the user's message. If the message is already correct, return it unchanged. Return ONLY the corrected text — no explanations, no quotes, no extra words.",
        },
        { role: "user", content: message },
      ],
      temperature: 0.1,
      max_tokens: 200,
    });

    const corrected = response.choices[0].message.content.trim();
    const wasChanged = corrected.toLowerCase() !== message.toLowerCase();
    return res.json({ status: true, corrected, wasChanged });
  } catch (error) {
    console.error("[AI] Grammar check error:", error.message);
    return res.json({ status: false, corrected: message });
  }
};