import { GoogleGenAI } from "@google/genai";

// Mảng các API keys
const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
].filter(Boolean) as string[];

// Biến cache để lưu API key đang hoạt động
let currentApiKeyIndex = 0;

// Check if an error is a quota limit error
const isQuotaLimitError = (error: any): boolean => {
  return (
    error.message?.includes("quota") ||
    error.message?.includes("limit") ||
    error.message?.includes("429") ||
    error.status === 429
  );
};

/**
 * Call Gemini API with automatic retries and API key rotation
 * @param prompt The text prompt to send to Gemini
 * @returns The text response from Gemini
 */
export async function callGeminiAPI(prompt: string): Promise<string> {
  let lastError: Error | null = null;
  let attempts = 0;

  // Try all API keys until successful
  while (attempts < GEMINI_API_KEYS.length) {
    try {
      const apiKey = GEMINI_API_KEYS[currentApiKeyIndex];
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      });

      return response.text || "";
    } catch (error: any) {
      lastError = error;

      // Switch to the next API key
      currentApiKeyIndex = (currentApiKeyIndex + 1) % GEMINI_API_KEYS.length;
      attempts++;

      // If we've tried all keys, throw error
      if (attempts >= GEMINI_API_KEYS.length) {
        throw new Error(
          "All API keys have hit quota limits or failed: " + error.message
        );
      }
    }
  }

  throw lastError || new Error("Failed to call Gemini API");
}

/**
 * Get a Gemini API instance with the current API key
 * @returns An object containing the Gemini API instance and the current API key index
 */
export function getGeminiAPI() {
  const apiKey = GEMINI_API_KEYS[currentApiKeyIndex];
  const ai = new GoogleGenAI({ apiKey });
  return {
    ai,
    apiKeyIndex: currentApiKeyIndex,
    rotateApiKey: () => {
      currentApiKeyIndex = (currentApiKeyIndex + 1) % GEMINI_API_KEYS.length;
      return GEMINI_API_KEYS[currentApiKeyIndex];
    },
  };
}

/**
 * Create a streaming response from Gemini API with automatic retries
 * @param prompt The text prompt to send to Gemini
 * @param options Additional options for the streaming request
 * @returns A readable stream of the Gemini API response
 */
export async function createGeminiStream(
  prompt: string,
  options?: {
    onError?: (error: Error) => void;
    model?: string;
  }
): Promise<ReadableStream> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let retryCount = 0;
      let success = false;
      let buffer = "";
      const model = options?.model || "gemini-2.5-flash";

      // Helper function to flush buffer
      const flushBuffer = () => {
        if (buffer.length > 0) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                chunk: buffer,
              }) + "\n"
            )
          );
          buffer = "";
        }
      };

      while (retryCount < GEMINI_API_KEYS.length && !success) {
        try {
          const geminiAPI = getGeminiAPI();
          const { ai } = geminiAPI;

          // Generate a streaming response from Gemini
          const streamingResponse = await ai.models.generateContentStream({
            model,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
              thinkingConfig: {
                thinkingBudget: 0,
              },
            },
          });

          // Process the stream from Gemini
          for await (const chunk of streamingResponse) {
            const chunkText = chunk.text || "";
            if (chunkText) {
              // Add to buffer
              buffer += chunkText;

              // If buffer exceeds threshold, send it
              if (buffer.length >= 20) {
                // Small buffer size for smoother streaming
                flushBuffer();

                // Add a small delay between chunks to avoid overwhelming the client
                await new Promise((resolve) => setTimeout(resolve, 5));
              }
            }
          }

          // Flush any remaining content in buffer
          flushBuffer();
          success = true;
        } catch (error: any) {
          console.error(`API Key ${currentApiKeyIndex} failed:`, error);

          // Switch to the next API key
          const geminiAPI = getGeminiAPI();
          geminiAPI.rotateApiKey();
          retryCount++;

          // Only retry if we have more API keys to try
          if (retryCount >= GEMINI_API_KEYS.length) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  error: "All API keys have hit quota limits",
                }) + "\n"
              )
            );
            if (options?.onError) {
              options.onError(new Error("All API keys have hit quota limits"));
            }
            break;
          }
        }
      }

      controller.close();
    },
  });
}
/**
 * Optimize text for image generation using Gemini AI
 * @param selectedText The text selected by the user
 * @param fullContext The complete paragraph context
 * @returns Optimized prompt for image generation
 */
export async function optimizeImagePrompt(
  selectedText: string,
  fullContext: string
): Promise<string> {
  const payingApiKey = process.env.GEMINI_API_KEY_PAYING;

  if (!payingApiKey) {
    throw new Error("GEMINI_API_KEY_PAYING not configured");
  }

  const ai = new GoogleGenAI({ apiKey: payingApiKey });

  const promptTemplate = `
You are an expert at creating image generation prompts. Your task is to convert the given text into a detailed, visual prompt that will generate a cute cartoon-style illustration.

SELECTED TEXT: "${selectedText}"
FULL CONTEXT: "${fullContext}"

INSTRUCTIONS:
1. Focus primarily on the SELECTED TEXT, but use the full context for additional understanding
2. Create a prompt for a cute cartoon-style illustration with adorable characters
3. The style should be:
   - Cute and friendly cartoon characters
   - Bright, cheerful colors
   - Simple, clean art style
   - Suitable for all ages
   - Expressive and engaging

4. Include specific visual elements that represent the key concepts from the selected text
5. Keep the prompt concise but descriptive (under 200 words)

Generate ONLY the image prompt, no additional explanation:`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: promptTemplate,
      config: {
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    });

    const optimizedPrompt = response.text?.trim() || "";

    if (!optimizedPrompt) {
      throw new Error("Failed to generate optimized prompt");
    }

    return optimizedPrompt;
  } catch (error: any) {
    console.error("Gemini prompt optimization error:", error);
    throw new Error(`Failed to optimize image prompt: ${error.message}`);
  }
}
