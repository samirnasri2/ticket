import OpenAI from "openai";

const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "placeholder";

if (!baseURL) {
  console.warn("AI_INTEGRATIONS_OPENAI_BASE_URL not set. AI features will be disabled.");
}

export const openai = baseURL
  ? new OpenAI({ apiKey, baseURL })
  : null;

export async function askAI(messages: { role: "user" | "assistant" | "system"; content: string }[], maxTokens = 500): Promise<string> {
  if (!openai) return "AI is not configured. Please set up the AI integration.";
  
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages,
    max_completion_tokens: maxTokens,
  });
  
  return response.choices[0]?.message?.content ?? "No response generated.";
}
