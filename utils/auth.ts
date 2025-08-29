import { prisma } from "@/lib/prisma";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const SECRET_KEY = process.env.JWT_SECRET_KEY || "hihihehe@@";

// Base time values as strings
const ACCESS_TOKEN_DURATION = "30m";
const REFRESH_TOKEN_DURATION = "7d";

// Function to convert duration string to seconds
function durationToSeconds(duration: string): number {
  const value = parseInt(duration);
  const unit = duration.slice(-1);

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 60 * 60;
    case "d":
      return value * 24 * 60 * 60;
    default:
      return 0;
  }
}

// Calculate seconds from the duration strings
const ACCESS_TOKEN_SECONDS = durationToSeconds(ACCESS_TOKEN_DURATION);
const REFRESH_TOKEN_SECONDS = durationToSeconds(REFRESH_TOKEN_DURATION);

export async function signJWT(payload: any, expiresIn: string) {
  const secretKey = new TextEncoder().encode(SECRET_KEY);

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);
}

export async function verifyJWT<T>(token: string): Promise<T | null> {
  try {
    const secretKey = new TextEncoder().encode(SECRET_KEY);
    const { payload } = await jwtVerify(token, secretKey);
    return payload as T;
  } catch (error) {
    return null;
  }
}

export async function getToken() {
  const token = (await cookies()).get("access_token")?.value || "";

  return token;
}

export async function getRefreshToken() {
  const refreshToken = (await cookies()).get("refresh_token")?.value || "";
  return refreshToken;
}

export async function refreshAccessToken(refreshToken: string) {
  try {
    // Verify refresh token
    const payload = await verifyJWT<{ sub: string; username: string }>(
      refreshToken
    );
    if (!payload) return null;

    // Check if refresh token exists in database
    const user = await prisma.user.findFirst({
      where: {
        id: payload.sub,
        refreshToken,
      },
    });

    if (!user) return null;

    // Generate new tokens
    const tokens = await generateTokens(user.id);
    return tokens;
  } catch (error) {
    return null;
  }
}

export async function generateTokens(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  const { needChangePassword, id, username, role } = user as any;

  const object = {
    sub: id,
    username,
    needChangePassword,
    role,
  };

  // Generate access token
  const accessToken = await signJWT(object, ACCESS_TOKEN_DURATION);

  // Generate refresh token
  const refreshToken = await signJWT(object, REFRESH_TOKEN_DURATION);

  // Store refresh token in database
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken },
  });

  return { accessToken, refreshToken };
}

export function setTokenCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string
) {
  // Set HTTP-only cookies
  response.cookies.set({
    name: "access_token",
    value: accessToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ACCESS_TOKEN_SECONDS,
    path: "/",
  });

  response.cookies.set({
    name: "refresh_token",
    value: refreshToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: REFRESH_TOKEN_SECONDS,
    path: "/",
  });

  return response;
}

// Get user session from JWT token
export async function getServerSession() {
  try {
    const token = await getToken();
    if (!token) return null;

    const payload = await verifyJWT<{
      sub: string;
      username: string;
      needChangePassword?: boolean;
      role?: string;
    }>(token);
    if (!payload || !payload.sub) return null;

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        name: true,
        needChangePassword: true,
        role: true,
      },
    });

    if (!user) return null;

    return { user };
  } catch (error) {
    console.error("Error getting server session:", error);
    return null;
  }
}
