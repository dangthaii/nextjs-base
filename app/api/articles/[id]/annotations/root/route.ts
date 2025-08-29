import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/utils/auth";
import { callGeminiAPI } from "@/lib/gemini";
import { AnnotationSpan, RootAnalysisResult } from "@/lib/content-types";
import {
  CreateRootAnnotationSchema,
  RootAnalysisResultSchema,
} from "@/schemas/root-analysis";

// Create a new root annotation with structured analysis
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params;
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const validationResult = CreateRootAnnotationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          message: "Invalid request data",
          errors: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { blockId, selectedText, span, paragraphContent, metadata } =
      validationResult.data;

    // Verify article exists and user has access
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: { authorId: true },
    });

    if (!article) {
      return NextResponse.json(
        { message: "Article not found" },
        { status: 404 }
      );
    }

    if (article.authorId !== session.user.id) {
      return NextResponse.json(
        { message: "You do not have permission to annotate this article" },
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
- sameRoot should contain exactly 5 words (not prefix)
- All explanations in Vietnamese
- If no prefix exists, use null for prefixText
- connection's short and will be similar like this format: ad ("Hướng đến") + vi ("Nhìn / thấy") -> Hướng đến việc được thấy = Lời khuyên   
- Return only valid JSON, no additional text`;

    // Call AI service for structured analysis
    let aiResponse: string;
    try {
      aiResponse = await callGeminiAPI(prompt);
    } catch (error) {
      console.error("AI service error:", error);
      return NextResponse.json(
        {
          message: "AI analysis service is temporarily unavailable",
          details: ["Please try again in a few moments"],
        },
        { status: 503 }
      );
    }

    // Parse and validate AI response with enhanced error handling
    let rootAnalysis: RootAnalysisResult;
    try {
      const {
        extractAndCleanJsonFromResponse,
        validateRootAnalysisResult,
        attemptDataFix,
        validateCompleteRootAnalysis,
      } = await import("@/lib/validation/root-analysis");

      // Clean and extract JSON from AI response
      const cleanedJson = extractAndCleanJsonFromResponse(aiResponse);
      if (!cleanedJson) {
        console.error("No valid JSON found in AI response:", aiResponse);
        return NextResponse.json(
          {
            message: "AI service returned invalid response format",
            details: "No valid JSON structure found in response",
          },
          { status: 500 }
        );
      }

      // Parse the cleaned JSON
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(cleanedJson);
      } catch (parseError) {
        console.error("Failed to parse cleaned JSON:", parseError);
        return NextResponse.json(
          {
            message: "AI service returned malformed JSON",
            details: "JSON parsing failed after cleaning",
          },
          { status: 500 }
        );
      }

      // Validate the parsed response
      const validationResult = validateRootAnalysisResult(parsedResponse);
      if (!validationResult.success) {
        console.error(
          "AI response validation failed:",
          validationResult.error,
          validationResult.details
        );

        // Attempt to fix common issues
        const fixedData = attemptDataFix(parsedResponse);
        if (fixedData) {
          console.log("Successfully fixed AI response data");
          rootAnalysis = fixedData;
        } else {
          return NextResponse.json(
            {
              message: "AI service returned invalid data structure",
              details: validationResult.details || [
                validationResult.error || "Unknown validation error",
              ],
            },
            { status: 500 }
          );
        }
      } else {
        rootAnalysis = validationResult.data!;
      }

      // Perform comprehensive validation including word component checking
      const comprehensiveValidation = validateCompleteRootAnalysis(
        rootAnalysis,
        selectedText
      );
      if (!comprehensiveValidation.success) {
        console.error(
          "Comprehensive validation failed:",
          comprehensiveValidation.error
        );
        return NextResponse.json(
          {
            message: "AI analysis contains logical errors",
            details: [
              comprehensiveValidation.error ||
                "Word component validation failed",
            ],
          },
          { status: 500 }
        );
      }

      // Log warnings if any
      if (
        comprehensiveValidation.warnings &&
        comprehensiveValidation.warnings.length > 0
      ) {
        console.warn(
          "Root analysis validation warnings:",
          comprehensiveValidation.warnings
        );
      }
    } catch (error) {
      console.error("Failed to process AI response:", error);
      return NextResponse.json(
        {
          message: "Failed to process root analysis response",
          details: [
            error instanceof Error ? error.message : "Unknown processing error",
          ],
        },
        { status: 500 }
      );
    }

    // Create annotation in database with rootResult
    const annotation = await prisma.annotation.create({
      data: {
        articleId,
        blockId,
        type: "root",
        selectedText,
        result: `Root analysis: ${rootAnalysis.viMeaning}`, // Simple text for result field
        span: span as AnnotationSpan,
        rootResult: rootAnalysis, // Structured data in JSON field
        metadata: metadata || {},
      },
    });

    return NextResponse.json(
      {
        data: annotation,
        message: "Root annotation created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating root annotation:", error);

    // Provide more specific error messages based on error type
    if (error instanceof Error) {
      if (
        error.message.includes("timeout") ||
        error.message.includes("TIMEOUT")
      ) {
        return NextResponse.json(
          {
            message: "Request timed out while processing analysis",
            details: [
              "The analysis is taking longer than expected. Please try again.",
            ],
          },
          { status: 408 }
        );
      }

      if (
        error.message.includes("validation") ||
        error.message.includes("Invalid")
      ) {
        return NextResponse.json(
          {
            message: "Invalid input data",
            details: [error.message],
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        message: "Failed to create root annotation",
        details: ["An unexpected error occurred. Please try again."],
      },
      { status: 500 }
    );
  }
}
