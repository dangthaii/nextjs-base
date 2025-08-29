// lib/utils/validation.ts
import { NextResponse } from "next/server";
import { SafeParseReturnType, ZodError, ZodIssue } from "zod";

interface ValidationErrorResponse {
  error: string;
  field?: string;
  details?: string[];
}

/**
 * Extract first validation error message from ZodError
 * Returns the first error in field order priority
 */
export function getFirstValidationError(error: ZodError): {
  message: string;
  field: string;
} {
  // Sort issues by path to ensure consistent order
  const sortedIssues = error.issues.sort((a, b) => {
    const pathA = a.path.join(".");
    const pathB = b.path.join(".");
    return pathA.localeCompare(pathB);
  });

  const firstIssue = sortedIssues[0];

  return {
    message: firstIssue.message,
    field: firstIssue.path.join(".") || "unknown",
  };
}

/**
 * Get all validation error messages grouped by field
 */
export function getAllValidationErrors(
  error: ZodError
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  error.issues.forEach((issue: ZodIssue) => {
    const field = issue.path.join(".") || "root";
    if (!errors[field]) {
      errors[field] = [];
    }
    errors[field].push(issue.message);
  });

  return errors;
}

/**
 * Create validation error response with first error only
 */
export function createValidationErrorResponse(error: ZodError): NextResponse {
  const { message, field } = getFirstValidationError(error);

  return NextResponse.json(
    {
      error: message,
      field: field,
    } as ValidationErrorResponse,
    { status: 400 }
  );
}

/**
 * Create validation error response with all errors
 */
export function createDetailedValidationErrorResponse(
  error: ZodError
): NextResponse {
  const errors = getAllValidationErrors(error);
  const errorMessages = Object.values(errors).flat();

  return NextResponse.json(
    {
      error: "Validation failed",
      details: errorMessages,
    } as ValidationErrorResponse,
    { status: 400 }
  );
}

/**
 * Generic validation handler for API routes
 */
export function handleValidationError(
  result: any,
  mode: "first" | "all" = "first"
) {
  if (!result.success) {
    if (mode === "first") {
      return createValidationErrorResponse(result.error);
    }
    return createDetailedValidationErrorResponse(result.error);
  }
}
