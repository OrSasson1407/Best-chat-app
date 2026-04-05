// server/controllers/aiController.js
const { OpenAI } = require("openai");
const Message = require("../models/Message");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "dummy-key" });

const hasApiKey = () => {
  const key = process.env.OPENAI_API_KEY;
  return key && !key.includes("dummy-key") && !key.includes("REPLACE_THIS");
};

// --- Quick Replies ---
module.exports.generateQuickReplies = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string") return res.json({ status: false, msg: "Invalid message format" });
    if (!hasApiKey()) return res.status(200).json({ status: false, replies: [] });

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: 'Generate exactly 3 short casual quick replies. Return ONLY a JSON array of 3 strings. Example: ["Sounds good!", "I\'ll check it out.", "Thanks!"]' },
        { role: "user", content: message },
      ],
      temperature: 0.7,
    });

    try {
      const replies = JSON.parse(response.choices[0].message.content);
      return res.status(200).json({ status: true, replies });
    } catch {
      return res.status(200).json({ status: true, replies: ["Sounds good!", "Okay", "Thanks!"] });
    }
  } catch (error) {
    console.error("AI Quick Reply Error:", error.message);
    return res.status(200).json({ status: true, replies: ["Sounds good!", "Okay", "Thanks!"] });
  }
};

// --- Translate ---
module.exports.translateMessage = async (req, res, next) => {
  try {
    const { message, targetLanguage } = req.body;
    if (!hasApiKey()) return res.status(200).json({ status: false, msg: "AI translation not configured." });

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: `Translate to ${targetLanguage}. Return ONLY the translated text.` },
        { role: "user", content: message },
      ],
      temperature: 0.3,
    });

    return res.status(200).json({ status: true, translatedText: response.choices[0].message.content.trim() });
  } catch (error) {
    console.error("AI Translation Error:", error.message);
    return res.status(200).json({ status: false, msg: "AI translation currently unavailable." });
  }
};

// --- Chat Summarizer ---
module.exports.summarizeChat = async (req, res, next) => {
  try {
    const { from, to, limit = 50 } = req.body;
    if (!from || !to) return res.status(400).json({ status: false, msg: "Missing chat parameters" });
    if (!hasApiKey()) return res.status(200).json({ status: false, msg: "AI summarization not configured." });

    const messages = await Message.find({ users: { $all: [from, to] }, isDeleted: false, type: "text" })
      .sort({ _id: -1 }).limit(limit).populate("sender", "username");

    if (!messages || messages.length < 5) return res.json({ status: false, msg: "Not enough messages to summarize." });

    const transcript = messages.reverse().map((m) => `${m.sender?.username || "User"}: ${m.message.text}`).join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "Summarize this conversation in exactly 3 short bullet points. Focus on key decisions and important info. Ignore greetings." },
        { role: "user", content: `Conversation:\n\n${transcript}` },
      ],
      temperature: 0.5,
    });

    return res.status(200).json({ status: true, summary: response.choices[0].message.content.trim() });
  } catch (error) {
    console.error("AI Chat Summary Error:", error.message);
    return res.status(200).json({ status: false, msg: "AI summary currently unavailable." });
  }
};

// --- Sprint 1: Grammar & Spell Check ---
module.exports.grammarCheck = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string" || message.trim().length < 3) return res.json({ status: false, corrected: message });
    if (!hasApiKey()) return res.json({ status: false, corrected: message });

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "Fix any spelling or grammar mistakes. If already correct, return unchanged. Return ONLY the corrected text — no explanations, no quotes." },
        { role: "user", content: message },
      ],
      temperature: 0.1,
      max_tokens: 200,
    });

    const corrected = response.choices[0].message.content.trim();
    return res.json({ status: true, corrected, wasChanged: corrected.toLowerCase() !== message.toLowerCase() });
  } catch (error) {
    console.error("[AI] Grammar check error:", error.message);
    return res.json({ status: false, corrected: message });
  }
};

// =============================================================================
// SPRINT 2 — Sentiment / Tone Indicator
// =============================================================================
// Returns: { tone: "neutral"|"positive"|"angry"|"sad"|"harsh", score: 0-100, warning: bool }
module.exports.toneCheck = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string" || message.trim().length < 5) {
      return res.json({ status: true, tone: "neutral", score: 0, warning: false });
    }

    if (!hasApiKey()) {
      // Offline heuristic: flag obvious caps-heavy or profane-adjacent messages
      const capsRatio = (message.match(/[A-Z]/g) || []).length / message.length;
      const hasExclamations = (message.match(/!/g) || []).length >= 2;
      const warning = capsRatio > 0.5 || hasExclamations;
      return res.json({ status: true, tone: warning ? "harsh" : "neutral", score: warning ? 70 : 10, warning });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `Analyze the emotional tone of the message. Reply ONLY with a JSON object like:
{"tone":"neutral","score":15,"warning":false}
tone must be one of: neutral, positive, angry, sad, harsh, sarcastic
score is 0-100 (100 = extremely intense negative emotion)
warning is true only if score > 60 (likely to upset the recipient)
No other text.`,
        },
        { role: "user", content: message },
      ],
      temperature: 0.1,
      max_tokens: 60,
    });

    const raw = response.choices[0].message.content.trim().replace(/```json|```/g, "");
    const parsed = JSON.parse(raw);
    return res.json({ status: true, ...parsed });
  } catch (error) {
    console.error("[AI] Tone check error:", error.message);
    // Fail silently — tone check is advisory, never blocking
    return res.json({ status: true, tone: "neutral", score: 0, warning: false });
  }
};