import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/utils/auth";
import { AnnotationSpan } from "@/lib/content-types";

// Get all annotations for an article
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params;
    const session = await getServerSession();

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const blockId = searchParams.get("blockId");
    const type = searchParams.get("type");

    // Build where clause
    const where: any = {
      articleId,
    };

    if (blockId) {
      where.blockId = blockId;
    }

    if (type) {
      where.type = type;
    }

    // Fetch annotations from the new Annotation table
    const annotations = await prisma.annotation.findMany({
      where,
      orderBy: { timestamp: "asc" },
    });

    return NextResponse.json(
      {
        data: annotations,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching annotations:", error);
    return NextResponse.json(
      { message: "Failed to fetch annotations" },
      { status: 500 }
    );
  }
}

// Create a new annotation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params;
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      blockId, 
      type, 
      selectedText, 
      result, 
      span, 
      metadata 
    } = body;

    // Validate required fields
    if (!blockId || !type || !selectedText || !result || !span) {
      return NextResponse.json(
        { message: "Missing required fields: blockId, type, selectedText, result, span" },
        { status: 400 }
      );
    }

    // Validate span structure
    if (!span.startElement || !span.endElement || 
        typeof span.startOffset !== 'number' || 
        typeof span.endOffset !== 'number') {
      return NextResponse.json(
        { message: "Invalid span structure" },
        { status: 400 }
      );
    }

    // Verify article exists and user has access
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: { authorId: true },
    });

    if (!article) {
      return NextResponse.json(
        { message: "Article not found" },
        { status: 404 }
      );
    }

    if (article.authorId !== session.user.id) {
      return NextResponse.json(
        { message: "You do not have permission to annotate this article" },
        { status: 403 }
      );
    }

    // Create annotation in the new Annotation table
    const annotation = await prisma.annotation.create({
      data: {
        articleId,
        blockId,
        type,
        selectedText,
        result,
        span: span as AnnotationSpan,
        metadata: metadata || {},
      },
    });

    return NextResponse.json(
      {
        data: annotation,
        message: "Annotation created successfully"
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating annotation:", error);
    return NextResponse.json(
      { message: "Failed to create annotation" },
      { status: 500 }
    );
  }
}

// Delete annotations (supports selective deletion)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params;
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get query parameters for selective deletion
    const searchParams = request.nextUrl.searchParams;
    const blockId = searchParams.get("blockId");
    const annotationId = searchParams.get("annotationId");

    // Verify article exists and user has access
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: { authorId: true },
    });

    if (!article) {
      return NextResponse.json(
        { message: "Article not found" },
        { status: 404 }
      );
    }

    if (article.authorId !== session.user.id) {
      return NextResponse.json(
        { message: "You do not have permission to delete annotations for this article" },
        { status: 403 }
      );
    }

    // Build where clause for deletion
    const where: any = {
      articleId,
    };

    if (annotationId) {
      // Delete specific annotation
      where.id = annotationId;
    } else if (blockId) {
      // Delete all annotations for a specific block
      where.blockId = blockId;
    }

    // Delete annotations from the new Annotation table
    const deletedAnnotations = await prisma.annotation.deleteMany({
      where,
    });

    return NextResponse.json(
      {
        data: { 
          count: deletedAnnotations.count,
          message: `Deleted ${deletedAnnotations.count} annotation(s)`
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting annotations:", error);
    return NextResponse.json(
      { message: "Failed to delete annotations" },
      { status: 500 }
    );
  }
}
