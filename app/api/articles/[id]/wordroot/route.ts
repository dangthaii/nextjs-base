import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/utils/auth";
import { prisma } from "@/lib/prisma";
import { callGeminiAPI } from "@/lib/gemini";
import { RootAnalysisResult } from "@/lib/content-types";
import {
  WordrootAnalysisSchema,
  RootAnalysisResultSchema,
} from "@/schemas/root-analysis";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const articleId = id;
    const body = await request.json();

    // Validate request body
    const validationResult = WordrootAnalysisSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          message: "Invalid request data",
          errors: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { selectedText, paragraphContent } = validationResult.data;

    // Verify the article exists and user has access to it
    const article = await prisma.article.findUnique({
      where: { id: articleId },
    });

    if (!article) {
      return NextResponse.json(
        { message: "Article not found" },
        { status: 404 }
      );
    }

    // Check if the article belongs to the user or has public access
    const hasAccess =
      article.authorId === userId ||
      (article as any).isPublic ||
      (article as any).sharedWithUserIds?.includes(userId);

    if (!hasAccess) {
      return NextResponse.json(
        { message: "You don't have access to this article" },
        { status: 403 }
      );
    }

    // Create structured AI prompt for root analysis
    const prompt = `Analyze the word root for: "${selectedText}"

Context: "${paragraphContent}"

Return a JSON response with this exact structure:
{
  "viMeaning": "Vietnamese meaning of the word",
  "prefixText": "exact prefix in word or null",
  "rootText": "exact root in word",
  "connection": "brief Vietnamese explanation of prefix + root = meaning",
  "sameRoot": [
    {
      "word": "related word 1",
      "viMeaning": "meaning in Vietnamese",
      "prefixText": "prefix or null",
      "rootText": "root text",
      "connection": "connection explanation"
    }
  ]
}

Requirements:
- prefixText and rootText must appear exactly in the analyzed word
- sameRoot should contain exactly 5 words sharing the same ROOT (not prefix)
- All explanations in Vietnamese
- If no prefix exists, use null for prefixText
- Return only valid JSON, no additional text`;

    // Call AI service for structured analysis
    let aiResponse: string;
    try {
      aiResponse = await callGeminiAPI(prompt);
    } catch (error) {
      console.error("AI service error:", error);
      return NextResponse.json(
        { message: "Failed to generate root analysis" },
        { status: 500 }
      );
    }

    // Parse and validate AI response
    let rootAnalysis: RootAnalysisResult;
    try {
      // Clean the response to extract JSON
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in AI response");
      }

      const parsedResponse = JSON.parse(jsonMatch[0]);

      // Validate with Zod schema
      const validationResult =
        RootAnalysisResultSchema.safeParse(parsedResponse);
      if (!validationResult.success) {
        throw new Error(
          `Invalid AI response structure: ${validationResult.error.message}`
        );
      }

      rootAnalysis = validationResult.data;
    } catch (error) {
      console.error("Failed to parse AI response:", error);
      return NextResponse.json(
        { message: "Failed to parse root analysis response" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        data: rootAnalysis,
        message: "Root analysis completed successfully",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in streaming word root analysis:", error);
    return NextResponse.json(
      { message: "Failed to generate word root analysis" },
      { status: 500 }
    );
  }
}
