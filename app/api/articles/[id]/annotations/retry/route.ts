import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/utils/auth";
import { callGeminiAPI } from "@/lib/gemini";

interface AnnotationsData {
  annotatedText?: string;
  lastUpdated?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params; // Article ID validation handled by middleware
    const session = await getServerSession();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sentenceId, text } = body;

    if (!sentenceId || !text) {
      return NextResponse.json(
        { message: "SentenceId and text are required" },
        { status: 400 }
      );
    }

    // Fetch the sentence and its paragraph
    const sentence = await prisma.sentence.findUnique({
      where: { id: sentenceId },
      include: {
        paragraph: {
          include: {
            article: true,
          },
        },
      },
    });

    if (!sentence) {
      return NextResponse.json(
        { message: "Sentence not found" },
        { status: 404 }
      );
    }

    // Check if the user has permission (is the author of the article)
    if (sentence.paragraph.article.authorId !== userId) {
      return NextResponse.json(
        { message: "You don't have permission to retry this annotation" },
        { status: 403 }
      );
    }

    // Get more context from the paragraph
    const paragraphContent = sentence.paragraph.content;

    // Create a prompt with more context
    const prompt = `Hãy chú thích cho mình phần văn bản tiếng Anh sau: "${text}", có thể là từ, cụm từ, hoặc một biểu đạt chưa hoàn chỉnh.
Hãy output cho mình theo format này: [${text}|nghĩa tiếng việt]
Chỉ output đúng format, không output thêm nội dung nào khác.
Lưu ý cần dịch mượt mà, đúng ngữ cảnh, không lan man.
Phần văn bản cần được dịch chính xác theo bối cảnh (context).

Bối cảnh (context) có chứa từ cần chú thích:
${paragraphContent}`;

    // Call the shared Gemini API utility
    const result = await callGeminiAPI(prompt);

    // Get existing annotations
    const annotations = sentence.annotations as AnnotationsData | null;
    let updatedAnnotatedText = result;

    // If there are existing annotations, handle the replacement carefully
    if (annotations?.annotatedText) {
      const annotatedText = annotations.annotatedText;

      // Escape special regex characters in the text to search for
      const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      // Check if the text is already part of an annotation
      const annotationPattern = new RegExp(`\\[${escapedText}\\|(.*?)\\]`, "g");
      const hasExistingAnnotation = annotationPattern.test(annotatedText);

      if (hasExistingAnnotation) {
        // Replace the existing annotation with the new one
        updatedAnnotatedText = annotatedText.replace(annotationPattern, result);
      } else if (annotatedText.includes(text)) {
        // If text exists but is not annotated, replace it
        updatedAnnotatedText = annotatedText.replace(text, result);
      } else {
        // Use the original sentence content as reference if text not found
        updatedAnnotatedText = sentence.content.replace(text, result);
      }
    } else {
      // If no previous annotations, use the original sentence content
      updatedAnnotatedText = sentence.content.replace(text, result);
    }

    // Update the sentence annotations
    await prisma.sentence.update({
      where: { id: sentenceId },
      data: {
        annotations: {
          annotatedText: updatedAnnotatedText,
          lastUpdated: new Date(),
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error retrying annotation:", error);
    return NextResponse.json(
      { message: error.message || "Failed to retry annotation" },
      { status: 500 }
    );
  }
}
