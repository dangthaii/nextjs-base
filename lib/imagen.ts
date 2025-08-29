import { GoogleGenAI } from "@google/genai";

/**
 * Generate an image using Google's Imagen 4 model
 * @param prompt The optimized prompt for image generation
 * @returns Base64 encoded image data (without data URL prefix)
 */
export async function generateImage(prompt: string): Promise<string> {
  const payingApiKey = process.env.GEMINI_API_KEY_PAYING;

  if (!payingApiKey) {
    throw new Error("GEMINI_API_KEY_PAYING not configured");
  }

  const ai = new GoogleGenAI({ apiKey: payingApiKey });

  try {
    const response = await ai.models.generateImages({
      model: "imagen-4.0-generate-preview-06-06",
      prompt: prompt,
      config: {
        numberOfImages: 1,
      },
    });

    const generatedImages = response.generatedImages;

    if (!generatedImages || generatedImages.length === 0) {
      throw new Error("No images were generated");
    }

    const firstImage = generatedImages[0];

    // Check for imageBytes field instead of image
    const imageBytes = firstImage.image?.imageBytes;

    if (!imageBytes) {
      throw new Error("Generated image data is empty");
    }

    // Return the base64 string directly (without data URL prefix)
    return imageBytes;
  } catch (error: any) {
    console.error("Imagen generation error:", error);
    throw new Error(`Failed to generate image: ${error.message}`);
  }
}

/**
 * Generate an image with cartoon style instructions
 * @param optimizedPrompt The prompt optimized by Gemini
 * @returns Base64 encoded image data (without data URL prefix)
 */
export async function generateCartoonImage(
  optimizedPrompt: string
): Promise<string> {
  // Enhance the prompt with cartoon style instructions
  const cartoonStylePrompt = `${optimizedPrompt}

Style: Cute cartoon illustration, adorable characters, bright cheerful colors, simple clean art style, suitable for all ages, expressive and engaging, digital art, high quality`;

  return generateImage(cartoonStylePrompt);
}

export default {
  generateImage,
  generateCartoonImage,
};
