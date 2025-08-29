import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/utils/auth";
import { prisma } from "@/lib/prisma";
import { optimizeImagePrompt } from "@/lib/gemini";
import { generateCartoonImage } from "@/lib/imagen";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
          code: "AUTH_ERROR",
        },
        { status: 401 }
      );
    }

    // Check admin role
    if (session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Admin access required", code: "AUTH_ERROR" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { paragraphId, selectedText, fullContext } = body;

    // Validate input
    if (!paragraphId || !selectedText || !fullContext) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required fields: paragraphId, selectedText, fullContext",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    // Verify paragraph exists and user has access
    const paragraph = await prisma.paragraph.findFirst({
      where: {
        id: paragraphId,
        article: {
          authorId: session.user.id,
        },
      },
      include: {
        article: true,
      },
    });

    if (!paragraph) {
      return NextResponse.json(
        {
          success: false,
          error: "Paragraph not found or access denied",
          code: "VALIDATION_ERROR",
        },
        { status: 404 }
      );
    }

    // Step 1: Optimize prompt using Gemini
    let optimizedPrompt: string;
    try {
      optimizedPrompt = await optimizeImagePrompt(selectedText, fullContext);
    } catch (error: any) {
      console.error("Prompt optimization failed:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to optimize image prompt",
          code: "AI_ERROR",
        },
        { status: 500 }
      );
    }

    // Step 2: Generate image using Imagen 4
    let imageData: string;
    try {
      imageData = await generateCartoonImage(optimizedPrompt);
    } catch (error: any) {
      console.error("Image generation failed:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to generate image",
          code: "AI_ERROR",
        },
        { status: 500 }
      );
    }

    // Step 3: Upload to Cloudinary
    let cloudinaryResult;
    try {
      cloudinaryResult = await uploadImageToCloudinary(imageData, {
        folder: "paragraph-images",
        public_id: `paragraph-${paragraphId}-${Date.now()}`,
      });

      if (!cloudinaryResult.success) {
        throw new Error(cloudinaryResult.error || "Upload failed");
      }
    } catch (error: any) {
      console.error("Cloudinary upload failed:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to upload image to cloud storage",
          code: "STORAGE_ERROR",
        },
        { status: 500 }
      );
    }

    // Step 4: Store in database
    try {
      // Create new GeneratedImage record
      await prisma.generatedImage.create({
        data: {
          imageUrl: cloudinaryResult.url,
          prompt: optimizedPrompt,
          selectedText: selectedText,
          paragraphId: paragraphId,
        },
      });
    } catch (error: any) {
      console.error("Database update failed:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to save image information",
          code: "STORAGE_ERROR",
        },
        { status: 500 }
      );
    }

    // Return success response
    return NextResponse.json({
      success: true,
      imageUrl: cloudinaryResult.url,
    });
  } catch (error: any) {
    console.error("Unexpected error in image generation:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        code: "STORAGE_ERROR",
      },
      { status: 500 }
    );
  }
}
