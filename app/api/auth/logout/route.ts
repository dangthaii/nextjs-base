import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getToken, verifyJWT } from "@/utils/auth";

export async function POST(request: NextRequest) {
  try {
    const accessToken = await getToken();
    // Verify the access token to get the user ID
    const payload = await verifyJWT<{ sub: string }>(accessToken);

    // If the token is valid, remove the refresh token from the user in the database
    if (payload?.sub) {
      await prisma.user.update({
        where: { id: payload.sub },
        data: { refreshToken: null },
      });
    }

    // Create response
    const response = NextResponse.json(
      { message: "Đăng xuất thành công" },
      { status: 200 }
    );

    // Clear cookies
    response.cookies.set({
      name: "access_token",
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0, // Expire immediately
      path: "/",
    });

    response.cookies.set({
      name: "refresh_token",
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0, // Expire immediately
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Error logging out:", error);
    return NextResponse.json(
      { message: "Đăng xuất thất bại" },
      { status: 500 }
    );
  }
}
