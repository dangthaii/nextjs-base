import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/utils/auth";
import { prisma } from "@/lib/prisma";
import { callGeminiAPI } from "@/lib/gemini";

interface AnnotationsData {
  annotatedText?: string;
  lastUpdated?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    const userId = session?.user?.id;

    const body = await request.json();
    const { prompt, paragraphId, sentenceId, selectedText } = body;

    if (!prompt) {
      return NextResponse.json(
        { message: "Prompt is required" },
        { status: 400 }
      );
    }

    // Use the shared callGeminiAPI utility function
    const result = await callGeminiAPI(prompt);

    // If paragraphId is provided, update the paragraph's annotations
    if (paragraphId) {
      const paragraph = await prisma.paragraph.findUnique({
        where: { id: paragraphId },
        include: { article: true, sentences: { orderBy: { order: "asc" } } },
      });

      // Verify permission
      if (paragraph && paragraph.article.authorId === userId) {
        // If we're processing a specific sentence
        if (sentenceId) {
          const sentence = await prisma.sentence.findUnique({
            where: { id: sentenceId },
          });

          if (sentence && sentence.paragraphId === paragraphId) {
            // Update sentence with annotations
            await prisma.sentence.update({
              where: { id: sentenceId },
              data: {
                annotations: {
                  annotatedText: result,
                  lastUpdated: new Date(),
                },
              },
            });
          }
        }
        // If it's a specific text selection from a paragraph (not a full sentence)
        else if (selectedText) {
          // Find which sentence contains the selected text
          const sentenceWithText = paragraph.sentences.find((sentence) =>
            sentence.content.includes(selectedText)
          );

          if (sentenceWithText) {
            // Check if there are existing annotations
            const annotations =
              sentenceWithText.annotations as AnnotationsData | null;

            if (annotations?.annotatedText) {
              // If there are existing annotations, we need to update them
              // This is a simple replace operation; for more complex cases a better merge strategy might be needed
              const annotatedContent = annotations.annotatedText.replace(
                selectedText,
                result
              );

              await prisma.sentence.update({
                where: { id: sentenceWithText.id },
                data: {
                  annotations: {
                    annotatedText: annotatedContent,
                    lastUpdated: new Date(),
                  },
                },
              });
            } else {
              // For first annotation, we just need to apply the annotation to the original content
              const annotatedContent = sentenceWithText.content.replace(
                selectedText,
                result
              );

              await prisma.sentence.update({
                where: { id: sentenceWithText.id },
                data: {
                  annotations: {
                    annotatedText: annotatedContent,
                    lastUpdated: new Date(),
                  },
                },
              });
            }
          } else {
            // If we can't find the exact sentence, fall back to updating the first sentence
            if (paragraph.sentences.length > 0) {
              const firstSentence = paragraph.sentences[0];
              const annotations =
                firstSentence.annotations as AnnotationsData | null;

              if (annotations?.annotatedText) {
                // If there are existing annotations, append the new one
                await prisma.sentence.update({
                  where: { id: firstSentence.id },
                  data: {
                    annotations: {
                      annotatedText: annotations.annotatedText + " " + result,
                      lastUpdated: new Date(),
                    },
                  },
                });
              } else {
                // For first annotation on this sentence
                await prisma.sentence.update({
                  where: { id: firstSentence.id },
                  data: {
                    annotations: {
                      annotatedText: firstSentence.content.replace(
                        selectedText,
                        result
                      ),
                      lastUpdated: new Date(),
                    },
                  },
                });
              }
            }
          }
        } else {
          // Process the entire paragraph
          // Instead of splitting the result into sentences, keep it as one annotated paragraph
          // and assign it to the first sentence
          if (paragraph.sentences.length > 0) {
            await prisma.sentence.update({
              where: { id: paragraph.sentences[0].id },
              data: {
                annotations: {
                  annotatedText: result,
                  lastUpdated: new Date(),
                },
              },
            });
          }
        }
      }
    }

    return NextResponse.json(
      {
        data: result,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("Failed to process with Gemini:", error);
    return NextResponse.json(
      { message: "Failed to process with Gemini" },
      { status: 500 }
    );
  }
}
