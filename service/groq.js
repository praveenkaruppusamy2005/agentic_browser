import fetch from "cross-fetch";
import dotenv from "dotenv";
import { createClient } from '@deepgram/sdk';

dotenv.config();

// OpenRouter API for google/gemma-3-27b-it:free

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.warn("[OpenRouter] OPENROUTER_API_KEY is not set. Set it in your environment before running.");
}

// The detailed system prompt for the voice assistant role
const VOICE_ASSISTANT_PROMPT = `
#Role
You are a general-purpose virtual assistant speaking to users over the phone. Your task is to help them find accurate, helpful information across a wide range of everyday topics.

#General Guidelines
-Be warm, friendly, and professional.
-Speak clearly and naturally in plain language.
-Keep most responses to 1–2 sentences and under 120 characters unless the caller asks for more detail (max: 300 characters).
-Do not use markdown formatting, like code blocks, quotes, bold, links, or italics.
-Use line breaks in lists.
-Use varied phrasing; avoid repetition.
-If unclear, ask for clarification.
-If the user’s message is empty, respond with an empty message.
-If asked about your well-being, respond briefly and kindly.

#Voice-Specific Instructions
-Speak in a conversational tone—your responses will be spoken aloud.
-Pause after questions to allow for replies.
-Confirm what the customer said if uncertain.
-Never interrupt.

#Style
-Use active listening cues.
-Be warm and understanding, but concise.
-Use simple words unless the caller uses technical terms.

#Call Flow Objective
-Greet the caller and introduce yourself:
“Hi there, I’m your virtual assistant—how can I help today?”
-Your primary goal is to help users quickly find the information they’re looking for. This may include:
Quick facts: “The capital of Japan is Tokyo.”
Weather: “It’s currently 68 degrees and cloudy in Seattle.”
Local info: “There’s a pharmacy nearby open until 9 PM.”
Basic how-to guidance: “To restart your phone, hold the power button for 5 seconds.”
FAQs: “Most returns are accepted within 30 days with a receipt.”
Navigation help: “Can you tell me the address or place you’re trying to reach?”
-If the request is unclear:
“Just to confirm, did you mean…?” or “Can you tell me a bit more?”
-If the request is out of scope (e.g. legal, financial, or medical advice):
“I’m not able to provide advice on that, but I can help you find someone who can.”

#Off-Scope Questions
-If asked about sensitive topics like health, legal, or financial matters:
“I’m not qualified to answer that, but I recommend reaching out to a licensed professional.”

#User Considerations
-Callers may be in a rush, distracted, or unsure how to phrase their question. Stay calm, helpful, and clear—especially when the user seems stressed, confused, or overwhelmed.

#Closing
-Always ask:
“Is there anything else I can help you with today?”
-Then thank them warmly and say:
“Thanks for calling. Take care and have a great day!”
        
`;

/**
/**
 * Call OpenRouter Gemma chat completion with the voice-optimized system prompt and conversation history.
 * @param {string} userText - user voice text to send as prompt
 * @param {object} [options]
 * @param {string} [options.systemPrompt] - optional system prompt override
 * @param {Array<{role: 'user'|'assistant', content: string}>} [options.history] - conversation history
 * @returns {Promise<{text: string, audio: string|null}>} assistant text and audio base64
 */
export async function runGroqAgent(userText, options = {}) {
  if (!userText || !userText.trim()) return { text: "", audio: null };

  // Use the provided override or the default Voice Assistant Prompt
  let systemPrompt = options.systemPrompt || VOICE_ASSISTANT_PROMPT;

  // Build conversation history for context
  const history = Array.isArray(options.history) ? options.history : [];

  // Try to extract user's name from history for better memory
  let userName = null;
  for (const msg of history) {
    if (msg.role === 'user') {
      const match = msg.content.match(/my name is ([A-Za-z0-9_\- ]+)/i);
      if (match) {
        userName = match[1].trim();
      }
    }
  }
  if (userName) {
    systemPrompt = `The user's name is ${userName}.\n` + systemPrompt;
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userText.trim() }
  ];

  const body = {
    model: "meta-llama/llama-3.3-70b-instruct:free",
    messages
  };

  try {
    const res = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://openrouter.ai/",
        "X-Title": "Agentic Browser Voice Assistant"
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[OpenRouter] HTTP ${res.status}:`, text);
      throw new Error(`[OpenRouter] HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "";

    // Deepgram TTS - return audio as base64 string
    let audioBase64 = null;
    if (content) {
      try {
        const deepgram = createClient(DEEPGRAM_API_KEY);
        const response = await deepgram.speak.request(
          { text: content },
          { model: 'aura-2-thalia-en' }
        );
        const stream = await response.getStream();
        if (stream) {
          // Collect audio data into a buffer
          const chunks = [];
          for await (const chunk of stream) {
            chunks.push(chunk);
          }
          const audioBuffer = Buffer.concat(chunks);
          audioBase64 = audioBuffer.toString('base64');
        } else {
          console.error('[Deepgram] Error generating audio:', stream);
        }
      } catch (e) {
        console.error('[Deepgram] Error writing audio to buffer:', e);
      }
    }
    return { text: content, audio: audioBase64 };
  } catch (err) {
    console.error("[OpenRouter] Error in runGroqAgent:", err);
    return { text: "", audio: null };
  }
}

export default runGroqAgent;