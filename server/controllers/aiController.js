// server/controllers/aiController.js
const { OpenAI } = require("openai");

// Import the Message model to fetch the chat history for the summarizer
const Message = require("../models/Message");

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

    // ✅ FIX: Safely catch missing or dummy API keys
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('dummy-key')) {
        throw new Error("OpenAI API Key is missing or invalid in server environment");
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
    
    // ✅ FIX: Safe JSON parsing with fallback
    try {
        const replies = JSON.parse(repliesText);
        return res.status(200).json({ status: true, replies });
    } catch (parseErr) {
        return res.status(200).json({ status: true, replies: ["Sounds good!", "Okay", "Thanks!"] }); 
    }
  } catch (error) {
    console.error("AI Quick Reply Error:", error.message || error);
    return res.status(500).json({ status: false, msg: "Failed to generate replies" });
  }
};

module.exports.translateMessage = async (req, res, next) => {
  try {
    const { message, targetLanguage } = req.body;

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('dummy-key')) {
        throw new Error("OpenAI API Key is missing or invalid in server environment");
    }

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
    console.error("AI Translation Error:", error.message || error);
    return res.status(500).json({ status: false, msg: "Failed to translate message" });
  }
};

// --- FEATURE 2: AI Chat Summarizer ---
module.exports.summarizeChat = async (req, res, next) => {
  try {
    const { from, to, limit = 50 } = req.body;

    if (!from || !to) {
        return res.status(400).json({ status: false, msg: "Missing chat parameters" });
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('dummy-key')) {
        throw new Error("OpenAI API Key is missing or invalid in server environment");
    }

    // 1. Fetch the last 'X' messages from this specific conversation
    const messages = await Message.find({ 
        users: { $all: [from, to] },
        isDeleted: false,
        type: "text" // Only summarize text, skip images/files/polls
    })
    .sort({ _id: -1 })
    .limit(limit)
    .populate("sender", "username"); // Get the usernames so the AI knows who is talking

    if (!messages || messages.length < 5) {
        return res.json({ status: false, msg: "Not enough messages to summarize. Read them yourself! 😉" });
    }

    // 2. Format the messages into a readable transcript for the AI
    // We reverse it so it reads in chronological order (oldest to newest)
    const transcript = messages.reverse().map(msg => {
        const senderName = msg.sender?.username || "Unknown User";
        return `${senderName}: ${msg.message.text}`;
    }).join("\n");

    // 3. Send the transcript to OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { 
            role: "system", 
            content: "You are a smart chat assistant. Summarize the following conversation transcript in exactly 3 short, punchy bullet points. Focus on key decisions, events, or important shared information. Ignore basic greetings." 
        },
        { 
            role: "user", 
            content: `Here is the conversation:\n\n${transcript}` 
        }
      ],
      temperature: 0.5, // Lower temperature for more factual summaries
    });

    const summary = response.choices[0].message.content.trim();

    return res.status(200).json({ status: true, summary });
  } catch (error) {
    console.error("AI Chat Summary Error:", error.message || error);
    return res.status(500).json({ status: false, msg: "Failed to summarize chat" });
  }
};