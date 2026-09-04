const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_REQUEST_BYTES = 32 * 1024;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 12;
const MAX_REPLY_LENGTH = 8000;
const ALLOWED_LANGUAGES = new Set(["ar", "en"]);
const ALLOWED_HISTORY_ROLES = new Set(["user", "assistant"]);

type Language = "ar" | "en";
type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};
type AssistantRequest = {
  message: string;
  language: Language;
  history: ConversationMessage[];
};

const careerFitSystemInstruction = (language: Language) => [
  "You are the CareerFit Lab assistant.",
  "Help visitors with CareerFit Lab and practical career guidance.",
  "Be concise, practical, and professional.",
  "Never promise employment or acceptance.",
  `Reply in ${language === "ar" ? "Arabic" : "English"}.`,
].join(" ");

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function invalidRequest() {
  return jsonResponse({ ok: false, error: "invalid_request" }, 400);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateRequest(value: unknown): AssistantRequest | null {
  if (!isPlainObject(value) || typeof value.message !== "string" || typeof value.language !== "string") {
    return null;
  }

  const message = value.message.trim();
  if (!message || message.length > MAX_MESSAGE_LENGTH || !ALLOWED_LANGUAGES.has(value.language)) {
    return null;
  }

  const historyValue = value.history === undefined ? [] : value.history;
  if (!Array.isArray(historyValue) || historyValue.length > MAX_HISTORY_MESSAGES) {
    return null;
  }

  const history: ConversationMessage[] = [];
  for (const item of historyValue) {
    if (!isPlainObject(item) || typeof item.role !== "string" || typeof item.content !== "string") {
      return null;
    }

    const content = item.content.trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH || !ALLOWED_HISTORY_ROLES.has(item.role)) {
      return null;
    }

    history.push({ role: item.role as ConversationMessage["role"], content });
  }

  return { message, language: value.language as Language, history };
}

function buildConversation(request: AssistantRequest) {
  return [
    { role: "system", content: careerFitSystemInstruction(request.language) },
    ...request.history,
    { role: "user", content: request.message },
  ];
}

/**
 * Provider adapter. It intentionally contains all OpenAI-compatible details so
 * another provider can replace this function without changing the HTTP contract.
 */
async function callAIProvider(conversation: Array<{ role: string; content: string }>) {
  const apiKey = Deno.env.get("AI_API_KEY");
  const apiUrl = Deno.env.get("AI_API_URL");
  const model = Deno.env.get("AI_MODEL") ?? "";

  if (!apiKey || !apiUrl || !model) {
    throw new Error("AI provider is not configured");
  }

  const providerResponse = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages: conversation, temperature: 0.3 }),
  });

  if (!providerResponse.ok) {
    throw new Error(`AI provider returned ${providerResponse.status}`);
  }

  const providerBody: unknown = await providerResponse.json();
  if (!isPlainObject(providerBody) || !Array.isArray(providerBody.choices)) {
    throw new Error("AI provider returned an invalid payload");
  }

  const firstChoice = providerBody.choices[0];
  if (!isPlainObject(firstChoice) || !isPlainObject(firstChoice.message) || typeof firstChoice.message.content !== "string") {
    throw new Error("AI provider returned no assistant reply");
  }

  const reply = firstChoice.message.content.trim();
  if (!reply || reply.length > MAX_REPLY_LENGTH) {
    throw new Error("AI provider returned an invalid assistant reply");
  }

  return reply;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);

  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) return invalidRequest();

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) return invalidRequest();

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return invalidRequest();
    }

    const assistantRequest = validateRequest(body);
    if (!assistantRequest) return invalidRequest();

    const reply = await callAIProvider(buildConversation(assistantRequest));
    return jsonResponse({ ok: true, reply });
  } catch (error) {
    console.error("careerfit-assistant provider failure", error);
    return jsonResponse({ ok: false, error: "assistant_unavailable" }, 500);
  }
});
