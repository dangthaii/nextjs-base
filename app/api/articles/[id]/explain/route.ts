import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/utils/auth";
import { prisma } from "@/lib/prisma";
import { createGeminiStream } from "@/lib/gemini";

// Buffer size for chunking (smaller chunks result in smoother streaming)
const CHUNK_BUFFER_SIZE = 20; // Characters

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

    const { id: articleId } = await params;
    const body = await request.json();
    const { selectedText, paragraphContent } = body;

    if (!selectedText || !paragraphContent) {
      return NextResponse.json(
        { message: "Selected text and paragraph content are required" },
        { status: 400 }
      );
    }

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

    // Create the prompt for explanation
    const prompt = `
Dịch mượt mà sang tiếng Việt và giải thích cho mình phần văn bản được chọn: "${selectedText}".
Bối cảnh của văn bản:
"${paragraphContent}"
- Dịch trước, sau đó giải thích.
- Dịch mượt mà, thay đổi cấu trúc câu, cách diễn đạt, từ ngữ nếu cần.
- Giải thích tập trung, không lan man.
- Sử dụng câu từ, văn phong mượt mà.
- Hãy thêm icon cho sinh động, và có chia các phần bằng các icon khác nhau.
- Có các gạch đầu dòng dạng list cho sinh động.
- KHÔNG SỬ DỤNG dấu gạch ngang "---" hoặc bất kỳ dấu phân cách ngang nào khác.

Trả lời cho mình bằng tiếng Việt và có thể sử dụng định dạng markdown.
    `;

    // Use the streaming utility
    const stream = await createGeminiStream(prompt, {
      model: "gemini-2.5-flash",
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: any) {
    console.error("Error in streaming explanation:", error);
    return NextResponse.json(
      { message: "Failed to generate explanation" },
      { status: 500 }
    );
  }
}
