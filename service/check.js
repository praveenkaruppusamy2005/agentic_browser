import fetch from "cross-fetch";
import dotenv from "dotenv";
dotenv.config();


const key = process.env.GOOGLE_API_KEY;

async function checkModels() {
  console.log("🔍 Pinging Google AI Studio...");
  
  // We list models using your specific API Key
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error("\n❌ API ERROR:", data.error.message);
      return;
    }

    if (data.models) {
      console.log("\n✅ YOUR AVAILABLE MODELS:");
      // Filter for models that support "generateContent" (chat)
      const chatModels = data.models
        .filter(m => m.supportedGenerationMethods.includes("generateContent"))
        .map(m => m.name.replace("models/", "")); // Clean up output

      console.log(chatModels.join("\n"));
      console.log("\n👉 Copy one of the names above into your GEMINI_CHAT_URL.");
    } else {
      console.log("⚠️ No models found. Check if your API Key has 'Generative Language API' enabled.");
    }
  } catch (error) {
    console.error("❌ Network Error:", error);
  }
}

checkModels();