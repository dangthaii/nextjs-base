/**
 * Integration tests for the root annotation creation API endpoint
 * Tests the complete flow from API request to database storage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../root/route";
import { prisma } from "@/lib/prisma";

// Mock the AI service
vi.mock("@/lib/gemini", () => ({
  generateText: vi.fn(),
}));

// Mock the auth utility
vi.mock("@/utils/auth", () => ({
  verifyToken: vi.fn(),
}));

import { generateText } from "@/lib/gemini";
import { verifyToken } from "@/utils/auth";

const mockGenerateText = generateText as any;
const mockVerifyToken = verifyToken as any;

// Mock data
const mockUserId = "user-123";
const mockArticleId = "article-456";
const mockBlockId = "block-789";
const mockSelectedText = "understand";
const mockParagraphContent = "I want to understand the meaning of this word.";

const mockAIResponse = `{
  "viMeaning": "hiểu, nắm được",
  "prefixText": "under",
  "rootText": "stand",
  "connection": "under (dưới) + stand (đứng) -> đứng dưới để nắm bắt = hiểu",
  "sameRoot": [
    {
      "word": "standard",
      "viMeaning": "tiêu chuẩn",
      "prefixText": null,
      "rootText": "stand",
      "connection": "stand (đứng) -> cái để đứng làm chuẩn = tiêu chuẩn"
    },
    {
      "word": "outstanding",
      "viMeaning": "nổi bật",
      "prefixText": "out",
      "rootText": "stand",
      "connection": "out (ra ngoài) + stand (đứng) -> đứng ra ngoài = nổi bật"
    },
    {
      "word": "withstand",
      "viMeaning": "chịu đựng",
      "prefixText": "with",
      "rootText": "stand",
      "connection": "with (cùng) + stand (đứng) -> đứng cùng để chống lại = chịu đựng"
    },
    {
      "word": "grandstand",
      "viMeaning": "khán đài",
      "prefixText": "grand",
      "rootText": "stand",
      "connection": "grand (lớn) + stand (đứng) -> chỗ đứng lớn = khán đài"
    },
    {
      "word": "bandstand",
      "viMeaning": "sân khấu nhạc",
      "prefixText": "band",
      "rootText": "stand",
      "connection": "band (ban nhạc) + stand (đứng) -> chỗ đứng cho ban nhạc = sân khấu nhạc"
    }
  ]
}`;

const mockUser = {
  id: mockUserId,
  email: "test@example.com",
  role: "user" as const,
};

const mockArticle = {
  id: mockArticleId,
  title: "Test Article",
  content: [
    {
      id: mockBlockId,
      type: "paragraph" as const,
      content: mockParagraphContent,
    },
  ],
  authorId: mockUserId,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("POST /api/articles/[id]/annotations/root - Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful authentication
    mockVerifyToken.mockResolvedValue(mockUser);

    // Mock successful AI response
    mockGenerateText.mockResolvedValue(mockAIResponse);
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.annotation.deleteMany({
      where: { articleId: mockArticleId },
    });
    await prisma.article.deleteMany({
      where: { id: mockArticleId },
    });
    await prisma.user.deleteMany({
      where: { id: mockUserId },
    });
  });

  it("should create root annotation successfully with valid input", async () => {
    // Create test user and article
    await prisma.user.create({
      data: {
        id: mockUserId,
        email: mockUser.email,
        password: "hashedpassword",
        role: mockUser.role,
      },
    });

    await prisma.article.create({
      data: mockArticle,
    });

    // Create request
    const request = new NextRequest(
      "http://localhost:3000/api/articles/article-456/annotations/root",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-token",
        },
        body: JSON.stringify({
          blockId: mockBlockId,
          selectedText: mockSelectedText,
          paragraphContent: mockParagraphContent,
        }),
      }
    );

    // Call the API endpoint
    const response = await POST(request, { params: { id: mockArticleId } });
    const responseData = await response.json();

    // Verify response
    expect(response.status).toBe(201);
    expect(responseData).toMatchObject({
      id: expect.any(String),
      articleId: mockArticleId,
      blockId: mockBlockId,
      type: "root",
      selectedText: mockSelectedText,
      result: "",
      rootResult: {
        viMeaning: "hiểu, nắm được",
        prefixText: "under",
        rootText: "stand",
        connection:
          "under (dưới) + stand (đứng) -> đứng dưới để nắm bắt = hiểu",
        sameRoot: expect.arrayContaining([
          expect.objectContaining({
            word: "standard",
            viMeaning: "tiêu chuẩn",
            prefixText: null,
            rootText: "stand",
          }),
        ]),
      },
    });

    // Verify database storage
    const savedAnnotation = await prisma.annotation.findFirst({
      where: {
        articleId: mockArticleId,
        type: "root",
        selectedText: mockSelectedText,
      },
    });

    expect(savedAnnotation).toBeTruthy();
    expect(savedAnnotation?.rootResult).toEqual(responseData.rootResult);
  });

  it("should handle invalid JSON response from AI gracefully", async () => {
    // Create test user and article
    await prisma.user.create({
      data: {
        id: mockUserId,
        email: mockUser.email,
        password: "hashedpassword",
        role: mockUser.role,
      },
    });

    await prisma.article.create({
      data: mockArticle,
    });

    // Mock invalid AI response
    mockGenerateText.mockResolvedValue("Invalid JSON response");

    const request = new NextRequest(
      "http://localhost:3000/api/articles/article-456/annotations/root",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-token",
        },
        body: JSON.stringify({
          blockId: mockBlockId,
          selectedText: mockSelectedText,
          paragraphContent: mockParagraphContent,
        }),
      }
    );

    const response = await POST(request, { params: { id: mockArticleId } });
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.message).toContain("Failed to parse AI response");
  });

  it("should validate request body and return 400 for invalid input", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/articles/article-456/annotations/root",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-token",
        },
        body: JSON.stringify({
          // Missing required fields
          blockId: "",
          selectedText: "",
        }),
      }
    );

    const response = await POST(request, { params: { id: mockArticleId } });
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.message).toBe("Invalid request data");
    expect(responseData.errors).toBeDefined();
  });

  it("should return 401 for unauthenticated requests", async () => {
    mockVerifyToken.mockRejectedValue(new Error("Invalid token"));

    const request = new NextRequest(
      "http://localhost:3000/api/articles/article-456/annotations/root",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer invalid-token",
        },
        body: JSON.stringify({
          blockId: mockBlockId,
          selectedText: mockSelectedText,
          paragraphContent: mockParagraphContent,
        }),
      }
    );

    const response = await POST(request, { params: { id: mockArticleId } });
    const responseData = await response.json();

    expect(response.status).toBe(401);
    expect(responseData.message).toBe("Unauthorized");
  });

  it("should return 404 for non-existent article", async () => {
    // Don't create the article, so it doesn't exist
    await prisma.user.create({
      data: {
        id: mockUserId,
        email: mockUser.email,
        password: "hashedpassword",
        role: mockUser.role,
      },
    });

    const request = new NextRequest(
      "http://localhost:3000/api/articles/non-existent/annotations/root",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-token",
        },
        body: JSON.stringify({
          blockId: mockBlockId,
          selectedText: mockSelectedText,
          paragraphContent: mockParagraphContent,
        }),
      }
    );

    const response = await POST(request, { params: { id: "non-existent" } });
    const responseData = await response.json();

    expect(response.status).toBe(404);
    expect(responseData.message).toBe("Article not found");
  });

  it("should handle AI service failures gracefully", async () => {
    // Create test user and article
    await prisma.user.create({
      data: {
        id: mockUserId,
        email: mockUser.email,
        password: "hashedpassword",
        role: mockUser.role,
      },
    });

    await prisma.article.create({
      data: mockArticle,
    });

    // Mock AI service failure
    mockGenerateText.mockRejectedValue(new Error("AI service unavailable"));

    const request = new NextRequest(
      "http://localhost:3000/api/articles/article-456/annotations/root",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-token",
        },
        body: JSON.stringify({
          blockId: mockBlockId,
          selectedText: mockSelectedText,
          paragraphContent: mockParagraphContent,
        }),
      }
    );

    const response = await POST(request, { params: { id: mockArticleId } });
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.message).toContain("Failed to analyze word root");
  });

  it("should validate AI response structure and reject invalid responses", async () => {
    // Create test user and article
    await prisma.user.create({
      data: {
        id: mockUserId,
        email: mockUser.email,
        password: "hashedpassword",
        role: mockUser.role,
      },
    });

    await prisma.article.create({
      data: mockArticle,
    });

    // Mock AI response with invalid structure
    const invalidAIResponse = `{
      "viMeaning": "hiểu",
      "prefixText": "under",
      "rootText": "stand"
      // Missing connection and sameRoot fields
    }`;

    mockGenerateText.mockResolvedValue(invalidAIResponse);

    const request = new NextRequest(
      "http://localhost:3000/api/articles/article-456/annotations/root",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-token",
        },
        body: JSON.stringify({
          blockId: mockBlockId,
          selectedText: mockSelectedText,
          paragraphContent: mockParagraphContent,
        }),
      }
    );

    const response = await POST(request, { params: { id: mockArticleId } });
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.message).toContain("Invalid AI response structure");
  });
});
