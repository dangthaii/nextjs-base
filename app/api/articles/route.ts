import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/utils/auth";
import { RichContent } from "@/lib/content-types";

// Get all articles
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();

    // Get pagination parameters from URL
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = 10; // Fixed page size of 10 articles per page

    // Calculate skip for pagination
    const skip = (page - 1) * pageSize;

    // Get total count for pagination
    const totalCount = await prisma.article.count({
      where: {
        authorId: session?.user?.id,
      },
    });

    // Get paginated articles
    const articles = await prisma.article.findMany({
      where: {
        authorId: session?.user?.id,
      },
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        annotations: true,
        generatedImages: true,
      },
      skip,
      take: pageSize,
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSize);

    return NextResponse.json(
      {
        data: articles,
        pagination: {
          page,
          pageSize,
          totalPages,
          totalCount,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching articles:", error);
    return NextResponse.json(
      { message: "Failed to fetch articles" },
      { status: 500 }
    );
  }
}

// Create a new article with ultra-modern content structure
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();

    const body = await request.json();
    const { title, description, content } = body;

    // Validate required fields
    if (!title || !content) {
      return NextResponse.json(
        { message: "Title and content are required" },
        { status: 400 }
      );
    }

    // Validate content structure
    if (!content.blocks || !Array.isArray(content.blocks)) {
      return NextResponse.json(
        { message: "Invalid content structure. Expected RichContent with blocks array." },
        { status: 400 }
      );
    }

    // Create the article with ultra-modern content structure
    const article = await prisma.article.create({
      data: {
        title,
        description,
        content: content as RichContent, // Store the entire rich content structure
        authorId: session?.user?.id || "",
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        annotations: true,
        generatedImages: true,
      },
    });

    return NextResponse.json(
      {
        data: article,
        message: "Article created successfully with ultra-modern content structure"
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating article:", error);
    return NextResponse.json(
      { message: "Failed to create article" },
      { status: 500 }
    );
  }
}
