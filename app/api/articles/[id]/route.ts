import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/utils/auth";

// Get a specific article
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        annotations: {
          orderBy: { timestamp: "desc" },
        },
        generatedImages: {
          orderBy: { createdAt: "asc" },
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
        data: article,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching article:", error);
    return NextResponse.json(
      { message: "Failed to fetch article" },
      { status: 500 }
    );
  }
}

// Update an article
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    const userId = session?.user?.id;

    const { id } = await params;

    const body = await request.json();
    const { title, description, content } = body;

    // Check if article exists and belongs to user
    const existingArticle = await prisma.article.findUnique({
      where: { id },
    });

    if (!existingArticle) {
      return NextResponse.json(
        { message: "Article not found" },
        { status: 404 }
      );
    }

    if (existingArticle.authorId !== userId) {
      return NextResponse.json(
        { message: "You do not have permission to update this article" },
        { status: 403 }
      );
    }

    // Prepare update data
    const updateData: {
      title: string;
      description: string;
      content?: any;
    } = {
      title,
      description,
    };

    // Only update content if it's provided
    if (content) {
      updateData.content = content;
    }

    // Update the article
    const article = await prisma.article.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(
      {
        data: article,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating article:", error);
    return NextResponse.json(
      { message: "Failed to update article" },
      { status: 500 }
    );
  }
}

// Delete an article
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    const userId = session?.user?.id;

    const { id } = await params;

    // Check if article exists and belongs to user
    const existingArticle = await prisma.article.findUnique({
      where: { id },
    });

    if (!existingArticle) {
      return NextResponse.json(
        { message: "Article not found" },
        { status: 404 }
      );
    }

    if (existingArticle.authorId !== userId) {
      return NextResponse.json(
        { message: "You do not have permission to delete this article" },
        { status: 403 }
      );
    }

    // Delete the article (this will cascade delete paragraphs and sentences)
    await prisma.article.delete({
      where: { id },
    });

    return NextResponse.json(
      {
        data: { message: "Article deleted successfully" },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting article:", error);
    return NextResponse.json(
      { message: "Failed to delete article" },
      { status: 500 }
    );
  }
}
