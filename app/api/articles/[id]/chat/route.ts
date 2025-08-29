import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/utils/auth";
import { prisma } from "@/lib/prisma";
import { createGeminiStream } from "@/lib/gemini";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id: articleId } = await params;
    const body = await request.json();
    const { messages } = body as { messages?: Message[] };

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { message: "Messages are required" },
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

    // Build a conversation prompt from the history
    const historyPrompt = messages
      .map(
        (m) => `${m.role === "user" ? "Người dùng" : "Trợ lý"}: ${m.content}`
      )
      .join("\n");

    const prompt = `Bạn là trợ lý AI thân thiện, hài hước và giàu năng lượng.\n- Luôn trả lời bằng tiếng Việt rõ ràng, súc tích.\n- Có thể sử dụng markdown, bullet list, và icon cảm xúc (ví dụ: 😀😉🔥💡🚀) để làm câu trả lời sinh động và vui vẻ.\n- Tuyệt đối KHÔNG sử dụng dấu gạch ngang \"---\" làm phân cách.\n\nCuộc hội thoại:\n${historyPrompt}\nTrợ lý:`;

    const stream = await createGeminiStream(prompt, {
      model: "gemini-2.5-flash",
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Error in streaming chat:", error);
    return NextResponse.json(
      { message: "Failed to generate chat reply" },
      { status: 500 }
    );
  }
}
