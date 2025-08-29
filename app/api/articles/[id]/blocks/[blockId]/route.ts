import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/utils/auth";
import { ContentBlock } from "@/lib/content-types";

// Update a specific block structure in an article
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> }
) {
  try {
    const { id: articleId, blockId } = await params;
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { block }: { block: ContentBlock } = body;

    // Validate required fields
    if (!block || !block.id || !block.elements) {
      return NextResponse.json(
        { message: "Invalid block structure provided" },
        { status: 400 }
      );
    }

    // Verify article exists and user has access
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: {
        authorId: true,
        content: true,
      },
    });

    if (!article) {
      return NextResponse.json(
        { message: "Article not found" },
        { status: 404 }
      );
    }

    if (article.authorId !== session.user.id) {
      return NextResponse.json(
        { message: "You do not have permission to modify this article" },
        { status: 403 }
      );
    }

    // Parse current content
    const currentContent = article.content as {
      blocks: ContentBlock[];
      version: string;
    };
    if (!currentContent?.blocks) {
      return NextResponse.json(
        { message: "Article content structure is invalid" },
        { status: 400 }
      );
    }

    // Update the specific block in the content
    const updatedBlocks = currentContent.blocks.map(
      (existingBlock: ContentBlock) =>
        existingBlock.id === blockId ? block : existingBlock
    );

    // Check if block was found and updated
    const blockFound = currentContent.blocks.some(
      (b: ContentBlock) => b.id === blockId
    );
    if (!blockFound) {
      return NextResponse.json(
        { message: "Block not found in article" },
        { status: 404 }
      );
    }

    const updatedContent = {
      ...currentContent,
      blocks: updatedBlocks,
    };

    // Update article in database
    const updatedArticle = await prisma.article.update({
      where: { id: articleId },
      data: {
        content: updatedContent,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        title: true,
        content: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        data: updatedArticle,
        message: "Block structure updated successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating block structure:", error);
    return NextResponse.json(
      { message: "Failed to update block structure" },
      { status: 500 }
    );
  }
}
