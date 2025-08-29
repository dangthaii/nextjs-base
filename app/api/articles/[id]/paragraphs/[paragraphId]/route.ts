import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/utils/auth";

// Get a specific paragraph
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paragraphId: string }> }
) {
  try {
    const { id, paragraphId } = await params;
    const paragraph = await prisma.paragraph.findUnique({
      where: { id: paragraphId },
      include: {
        sentences: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!paragraph || paragraph.articleId !== id) {
      return NextResponse.json(
        { message: "Paragraph not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        data: paragraph,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching paragraph:", error);
    return NextResponse.json(
      { message: "Failed to fetch paragraph" },
      { status: 500 }
    );
  }
}

// Update a paragraph
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paragraphId: string }> }
) {
  try {
    const session = await getServerSession();
    const userId = session?.user?.id;

    const { id, paragraphId } = await params;
    const body = await request.json();
    const { content } = body;

    // Validate input
    if (!content) {
      return NextResponse.json(
        { message: "Content is required" },
        { status: 400 }
      );
    }

    // Check if paragraph exists and belongs to the right article
    const paragraph = await prisma.paragraph.findUnique({
      where: { id: paragraphId },
      include: {
        article: true,
      },
    });

    if (!paragraph || paragraph.articleId !== id) {
      return NextResponse.json(
        { message: "Paragraph not found" },
        { status: 404 }
      );
    }

    // Check if user has permission to update
    if (paragraph.article.authorId !== userId) {
      return NextResponse.json(
        { message: "You do not have permission to update this paragraph" },
        { status: 403 }
      );
    }

    // Delete existing sentences and create new ones based on updated content
    await prisma.$transaction(async (tx) => {
      // Delete existing sentences
      await tx.sentence.deleteMany({
        where: { paragraphId },
      });

      // Update paragraph
      await tx.paragraph.update({
        where: { id: paragraphId },
        data: { content },
      });

      // Create new sentences
      const sentences = content
        .split(/(?<=[.!?])\s+/)
        .filter(Boolean)
        .map((sentence: string, index: number) => ({
          content: sentence.trim(),
          order: index,
          paragraphId,
        }));

      if (sentences.length > 0) {
        await tx.sentence.createMany({
          data: sentences,
        });
      }
    });

    // Get updated paragraph with sentences
    const updatedParagraph = await prisma.paragraph.findUnique({
      where: { id: paragraphId },
      include: {
        sentences: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json(
      {
        data: updatedParagraph,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating paragraph:", error);
    return NextResponse.json(
      { message: "Failed to update paragraph" },
      { status: 500 }
    );
  }
}

// Delete a paragraph
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paragraphId: string }> }
) {
  try {
    const session = await getServerSession();
    const userId = session?.user?.id;

    const { id, paragraphId } = await params;

    // Check if paragraph exists and belongs to the right article
    const paragraph = await prisma.paragraph.findUnique({
      where: { id: paragraphId },
      include: {
        article: true,
      },
    });

    if (!paragraph || paragraph.articleId !== id) {
      return NextResponse.json(
        { message: "Paragraph not found" },
        { status: 404 }
      );
    }

    // Check if user has permission to delete
    if (paragraph.article.authorId !== userId) {
      return NextResponse.json(
        { message: "You do not have permission to delete this paragraph" },
        { status: 403 }
      );
    }

    // Delete the paragraph (this will cascade delete sentences)
    await prisma.paragraph.delete({
      where: { id: paragraphId },
    });

    // Reorder remaining paragraphs
    const paragraphs = await prisma.paragraph.findMany({
      where: {
        articleId: id,
        order: { gt: paragraph.order },
      },
      orderBy: { order: "asc" },
    });

    // Update orders
    for (const p of paragraphs) {
      await prisma.paragraph.update({
        where: { id: p.id },
        data: { order: p.order - 1 },
      });
    }

    return NextResponse.json(
      {
        data: { message: "Paragraph deleted successfully" },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting paragraph:", error);
    return NextResponse.json(
      { message: "Failed to delete paragraph" },
      { status: 500 }
    );
  }
}
