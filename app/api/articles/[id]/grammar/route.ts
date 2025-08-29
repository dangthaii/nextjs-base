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

    const { id } = await params;
    const articleId = id;
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

    // Create the prompt for grammar analysis
    const prompt = `
Phân tích ngữ pháp tiếng Anh cho phần văn bản được chọn: "${selectedText}".

Bối cảnh của văn bản:
"${paragraphContent}"

Hãy phân tích ngữ pháp bằng tiếng Việt với:

📚 **Phân tích cấu trúc ngữ pháp:**
- Xác định các thành phần chính (chủ ngữ, vị ngữ, bổ ngữ...)
- Loại câu và cấu trúc câu
- Thì, thể, cách của động từ (nếu có)

✨ **Giải thích chi tiết:**
- Tại sao sử dụng cấu trúc này?
- Ý nghĩa và cách dùng của các từ ngữ pháp
- Quy tắc ngữ pháp áp dụng

🎯 **Ví dụ tương tự:**
- Đưa ra 1-2 ví dụ có cấu trúc tương tự
- So sánh với tiếng Việt (nếu thích hợp)

Trả lời bằng tiếng Việt, sử dụng emoji cho sinh động, có sense of humor nhẹ nhàng nhưng vẫn giáo dục. Dùng markdown để format đẹp với bullet points.
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
    console.error("Error in streaming grammar analysis:", error);
    return NextResponse.json(
      { message: "Failed to generate grammar analysis" },
      { status: 500 }
    );
  }
}
