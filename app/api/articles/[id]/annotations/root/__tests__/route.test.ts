import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    article: {
      findUnique: vi.fn(),
    },
    annotation: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/utils/auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/gemini", () => ({
  callGeminiAPI: vi.fn(),
}));

vi.mock("@/lib/validation/root-analysis", () => ({
  extractAndCleanJsonFromResponse: vi.fn(),
  validateRootAnalysisResult: vi.fn(),
  attemptDataFix: vi.fn(),
  validateCompleteRootAnalysis: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/utils/auth";
import { callGeminiAPI } from "@/lib/gemini";
import {
  extractAndCleanJsonFromResponse,
  validateRootAnalysisResult,
  attemptDataFix,
  validateCompleteRootAnalysis,
} from "@/lib/validation/root-analysis";

describe("POST /api/articles/[id]/annotations/root", () => {
  const mockSession = {
    user: {
      id: "user-123",
      email: "test@example.com",
    },
  };

  const mockArticle = {
    id: "article-123",
    authorId: "user-123",
  };

  const validRequestBody = {
    blockId: "block-123",
    selectedText: "unhappy",
    span: {
      startElement: "element-1",
      startOffset: 0,
      endElement: "element-1",
      endOffset: 7,
    },
    paragraphContent: "The word unhappy means sad.",
    metadata: {},
  };

  const mockRootAnalysis = {
    viMeaning: "không vui",
    prefixText: "un",
    rootText: "happy",
    connection: "un (không) + happy (vui) = không vui",
    sameRoot: [
      {
        word: "happiness",
        viMeaning: "hạnh phúc",
        prefixText: null,
        rootText: "happy",
        connection: "happy (vui) + ness (tính chất) = hạnh phúc",
      },
      {
        word: "happily",
        viMeaning: "một cách vui vẻ",
        prefixText: null,
        rootText: "happy",
        connection: "happy (vui) + ly (cách thức) = một cách vui vẻ",
      },
      {
        word: "unhappiness",
        viMeaning: "sự không vui",
        prefixText: "un",
        rootText: "happy",
        connection:
          "un (không) + happy (vui) + ness (tính chất) = sự không vui",
      },
      {
        word: "happier",
        viMeaning: "vui hơn",
        prefixText: null,
        rootText: "happy",
        connection: "happy (vui) + er (hơn) = vui hơn",
      },
      {
        word: "happiest",
        viMeaning: "vui nhất",
        prefixText: null,
        rootText: "happy",
        connection: "happy (vui) + est (nhất) = vui nhất",
      },
    ],
  };

  const mockCreatedAnnotation = {
    id: "annotation-123",
    articleId: "article-123",
    blockId: "block-123",
    type: "root",
    selectedText: "unhappy",
    result: "Root analysis: không vui",
    span: validRequestBody.span,
    rootResult: mockRootAnalysis,
    metadata: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful mocks
    vi.mocked(getServerSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.article.findUnique).mockResolvedValue(mockArticle);
    vi.mocked(callGeminiAPI).mockResolvedValue(
      JSON.stringify(mockRootAnalysis)
    );
    vi.mocked(extractAndCleanJsonFromResponse).mockReturnValue(
      JSON.stringify(mockRootAnalysis)
    );
    vi.mocked(validateRootAnalysisResult).mockReturnValue({
      success: true,
      data: mockRootAnalysis,
    });
    vi.mocked(validateCompleteRootAnalysis).mockReturnValue({
      success: true,
    });
    vi.mocked(prisma.annotation.create).mockResolvedValue(
      mockCreatedAnnotation
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("creates root annotation successfully with valid input", async () => {
    const request = new NextRequest(
      "http://localhost/api/articles/article-123/annotations/root",
      {
        method: "POST",
        body: JSON.stringify(validRequestBody),
      }
    );

    const params = Promise.resolve({ id: "article-123" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.message).toBe("Root annotation created successfully");
    expect(data.data).toEqual(mockCreatedAnnotation);
    expect(prisma.annotation.create).toHaveBeenCalledWith({
      data: {
        articleId: "article-123",
        blockId: "block-123",
        type: "root",
        selectedText: "unhappy",
        result: "Root analysis: không vui",
        span: validRequestBody.span,
        rootResult: mockRootAnalysis,
        metadata: {},
      },
    });
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost/api/articles/article-123/annotations/root",
      {
        method: "POST",
        body: JSON.stringify(validRequestBody),
      }
    );

    const params = Promise.resolve({ id: "article-123" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toBe("Unauthorized");
  });

  it("returns 400 when request body is invalid", async () => {
    const invalidBody = {
      blockId: "", // Invalid empty string
      selectedText: "unhappy",
      // Missing required fields
    };

    const request = new NextRequest(
      "http://localhost/api/articles/article-123/annotations/root",
      {
        method: "POST",
        body: JSON.stringify(invalidBody),
      }
    );

    const params = Promise.resolve({ id: "article-123" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Invalid request data");
    expect(data.errors).toBeDefined();
  });

  it("returns 404 when article is not found", async () => {
    vi.mocked(prisma.article.findUnique).mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost/api/articles/article-123/annotations/root",
      {
        method: "POST",
        body: JSON.stringify(validRequestBody),
      }
    );

    const params = Promise.resolve({ id: "article-123" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toBe("Article not found");
  });

  it("returns 403 when user does not own the article", async () => {
    const otherUserArticle = {
      ...mockArticle,
      authorId: "other-user-456",
    };
    vi.mocked(prisma.article.findUnique).mockResolvedValue(otherUserArticle);

    const request = new NextRequest(
      "http://localhost/api/articles/article-123/annotations/root",
      {
        method: "POST",
        body: JSON.stringify(validRequestBody),
      }
    );

    const params = Promise.resolve({ id: "article-123" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toBe(
      "You do not have permission to annotate this article"
    );
  });

  it("returns 503 when AI service fails", async () => {
    vi.mocked(callGeminiAPI).mockRejectedValue(
      new Error("AI service unavailable")
    );

    const request = new NextRequest(
      "http://localhost/api/articles/article-123/annotations/root",
      {
        method: "POST",
        body: JSON.stringify(validRequestBody),
      }
    );

    const params = Promise.resolve({ id: "article-123" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.message).toBe("AI analysis service is temporarily unavailable");
  });

  it("returns 500 when AI response contains no valid JSON", async () => {
    vi.mocked(extractAndCleanJsonFromResponse).mockReturnValue(null);

    const request = new NextRequest(
      "http://localhost/api/articles/article-123/annotations/root",
      {
        method: "POST",
        body: JSON.stringify(validRequestBody),
      }
    );

    const params = Promise.resolve({ id: "article-123" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toBe("AI service returned invalid response format");
  });

  it("returns 500 when AI response validation fails", async () => {
    vi.mocked(validateRootAnalysisResult).mockReturnValue({
      success: false,
      error: "Invalid structure",
      details: ["Missing required fields"],
    });
    vi.mocked(attemptDataFix).mockReturnValue(null);

    const request = new NextRequest(
      "http://localhost/api/articles/article-123/annotations/root",
      {
        method: "POST",
        body: JSON.stringify(validRequestBody),
      }
    );

    const params = Promise.resolve({ id: "article-123" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toBe("AI service returned invalid data structure");
    expect(data.details).toEqual(["Missing required fields"]);
  });

  it("successfully fixes and uses corrected AI response data", async () => {
    vi.mocked(validateRootAnalysisResult).mockReturnValue({
      success: false,
      error: "Invalid structure",
    });
    vi.mocked(attemptDataFix).mockReturnValue(mockRootAnalysis);

    const request = new NextRequest(
      "http://localhost/api/articles/article-123/annotations/root",
      {
        method: "POST",
        body: JSON.stringify(validRequestBody),
      }
    );

    const params = Promise.resolve({ id: "article-123" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.message).toBe("Root annotation created successfully");
    expect(attemptDataFix).toHaveBeenCalled();
  });

  it("returns 500 when comprehensive validation fails", async () => {
    vi.mocked(validateCompleteRootAnalysis).mockReturnValue({
      success: false,
      error: "Word components don't match",
    });

    const request = new NextRequest(
      "http://localhost/api/articles/article-123/annotations/root",
      {
        method: "POST",
        body: JSON.stringify(validRequestBody),
      }
    );

    const params = Promise.resolve({ id: "article-123" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toBe("AI analysis contains logical errors");
    expect(data.details).toEqual(["Word components don't match"]);
  });

  it("logs warnings but continues when comprehensive validation has warnings", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(validateCompleteRootAnalysis).mockReturnValue({
      success: true,
      warnings: ["Some data quality issues"],
    });

    const request = new NextRequest(
      "http://localhost/api/articles/article-123/annotations/root",
      {
        method: "POST",
        body: JSON.stringify(validRequestBody),
      }
    );

    const params = Promise.resolve({ id: "article-123" });
    const response = await POST(request, { params });

    expect(response.status).toBe(201);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Root analysis validation warnings:",
      ["Some data quality issues"]
    );

    consoleSpy.mockRestore();
  });

  it("handles JSON parsing errors gracefully", async () => {
    vi.mocked(extractAndCleanJsonFromResponse).mockReturnValue(
      '{"invalid": json}'
    );

    const request = new NextRequest(
      "http://localhost/api/articles/article-123/annotations/root",
      {
        method: "POST",
        body: JSON.stringify(validRequestBody),
      }
    );

    const params = Promise.resolve({ id: "article-123" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toBe("AI service returned malformed JSON");
  });

  it("returns 408 for timeout errors", async () => {
    vi.mocked(callGeminiAPI).mockRejectedValue(new Error("Request TIMEOUT"));

    const request = new NextRequest(
      "http://localhost/api/articles/article-123/annotations/root",
      {
        method: "POST",
        body: JSON.stringify(validRequestBody),
      }
    );

    const params = Promise.resolve({ id: "article-123" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.message).toBe("AI analysis service is temporarily unavailable");
  });

  it("includes proper AI prompt structure", async () => {
    const request = new NextRequest(
      "http://localhost/api/articles/article-123/annotations/root",
      {
        method: "POST",
        body: JSON.stringify(validRequestBody),
      }
    );

    const params = Promise.resolve({ id: "article-123" });
    await POST(request, { params });

    expect(callGeminiAPI).toHaveBeenCalledWith(
      expect.stringContaining('Analyze the word root for: "unhappy"')
    );
    expect(callGeminiAPI).toHaveBeenCalledWith(
      expect.stringContaining('Context: "The word unhappy means sad."')
    );
    expect(callGeminiAPI).toHaveBeenCalledWith(
      expect.stringContaining(
        "Return a JSON response with this exact structure"
      )
    );
    expect(callGeminiAPI).toHaveBeenCalledWith(
      expect.stringContaining("sameRoot should contain exactly 5 words")
    );
  });
});
