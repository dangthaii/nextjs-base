import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/utils/auth";
import { prisma } from "@/lib/prisma";
import { createGeminiStream } from "@/lib/gemini";

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
    const { paragraphMarkdown, fullContextWithTarget } = body;

    if (!paragraphMarkdown) {
      return NextResponse.json(
        { message: "Paragraph markdown content is required" },
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
      (article as unknown as { isPublic?: boolean }).isPublic ||
      (
        article as unknown as { sharedWithUserIds?: string[] }
      ).sharedWithUserIds?.includes(userId);

    if (!hasAccess) {
      return NextResponse.json(
        { message: "You don't have access to this article" },
        { status: 403 }
      );
    }

    // Create the prompt for Vietnamese translation with full context
    let prompt = `
Bạn là một chuyên gia dịch thuật tiếng Việt. Hãy dịch đoạn văn được đánh dấu trong ngữ cảnh hoàn chình của bài viết.

**TOÀN BỘ NGỮ CẢNH CỦA BÀI VIẾT:**
${fullContextWithTarget || paragraphMarkdown}

**YÊU CẦU:**
- CHỈ dịch đoạn văn nằm giữa ">>> ĐOẠN CẦN DỊCH START <<<" và ">>> ĐOẠN CẦN DỊCH END <<<"
- KHÔNG dịch các đoạn văn khác trong ngữ cảnh
- Giữ nguyên định dạng markdown của văn bản gốc (in đậm, in nghiêng, code, v.v.)
- Dịch một cách tự nhiên và mượt mà, phù hợp với toàn bộ ngữ cảnh xung quanh
- Thay đổi cấu trúc câu, cách diễn đạt nếu cần để phù hợp với tiếng Việt
- Sử dụng ngữ cảnh toàn bài để hiểu đúng thuật ngữ, chủ đề và phong cách viết
- Đảm bảo sự liên kết logic và thống nhất với toàn bộ bài viết
- Trả về CHÍNH XÁC định dạng markdown, không thêm gì khác

**LƯU Ý QUAN TRỌNG:** Chỉ trả về bản dịch tiếng Việt của đoạn văn được đánh dấu, không bao gồm các dấu hiệu đánh dấu.`;

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
  } catch (error: unknown) {
    console.error("Error in streaming translation:", error);
    return NextResponse.json(
      { message: "Failed to generate translation" },
      { status: 500 }
    );
  }
}
