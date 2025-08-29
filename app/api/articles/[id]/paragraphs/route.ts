import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/utils/auth";

// Get all paragraphs for an article
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        paragraphs: {
          orderBy: { order: "asc" },
          include: {
            sentences: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (!article) {
      return NextResponse.json(
        { message: "Article not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        data: article.paragraphs,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching paragraphs:", error);
    return NextResponse.json(
      { message: "Failed to fetch paragraphs" },
      { status: 500 }
    );
  }
}

// Add a new paragraph to an article
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    const userId = session?.user?.id;

    const { id } = await params;

    const body = await request.json();
    const { content, order } = body;

    // Validate input
    if (!content) {
      return NextResponse.json(
        { message: "Content is required" },
        { status: 400 }
      );
    }

    // Check if article exists and belongs to user
    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        paragraphs: {
          orderBy: { order: "desc" },
          take: 1,
        },
      },
    });

    if (!article) {
      return NextResponse.json(
        { message: "Article not found" },
        { status: 404 }
      );
    }

    if (article.authorId !== userId) {
      return NextResponse.json(
        { message: "You do not have permission to modify this article" },
        { status: 403 }
      );
    }

    // If order is not provided, append to the end
    const newOrder = order ?? (article.paragraphs[0]?.order + 1 || 0);

    // Reorder existing paragraphs if needed
    if (order !== undefined) {
      await prisma.$transaction(async (tx) => {
        // Get paragraphs that need to be shifted
        const paragraphsToShift = await tx.paragraph.findMany({
          where: {
            articleId: id,
            order: {
              gte: newOrder,
            },
          },
          orderBy: { order: "asc" },
        });

        // Shift paragraphs one by one
        for (const paragraph of paragraphsToShift) {
          await tx.paragraph.update({
            where: { id: paragraph.id },
            data: { order: paragraph.order + 1 },
          });
        }
      });
    }

    // Create new paragraph
    const paragraph = await prisma.paragraph.create({
      data: {
        content,
        order: newOrder,
        articleId: id,
      },
    });

    // Optional: Split content into sentences and save them
    if (content) {
      const sentences = content
        .split(/(?<=[.!?])\s+/)
        .filter(Boolean)
        .map((sentence: string, index: number) => ({
          content: sentence.trim(),
          order: index,
          paragraphId: paragraph.id,
        }));

      if (sentences.length > 0) {
        await prisma.sentence.createMany({
          data: sentences,
        });
      }
    }

    // Get the created paragraph with sentences
    const createdParagraph = await prisma.paragraph.findUnique({
      where: { id: paragraph.id },
      include: {
        sentences: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json(
      {
        data: createdParagraph,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating paragraph:", error);
    return NextResponse.json(
      { message: "Failed to create paragraph" },
      { status: 500 }
    );
  }
}
