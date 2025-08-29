import { prisma } from "@/lib/prisma";
import { handleValidationError } from "@/lib/validation";
import { loginSchema } from "@/schemas/auth";
import { generateTokens, setTokenCookies } from "@/utils/auth";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validationResult = loginSchema.safeParse(body);
    handleValidationError(validationResult);

    const data = validationResult.data!;
    const { username, password } = data;

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json(
        { message: "Tài khoản không tồn tại" },
        { status: 404 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { message: "Tài khoản hoặc mật khẩu không chính xác" },
        { status: 401 }
      );
    }

    const { accessToken, refreshToken } = await generateTokens(user.id);

    const response = NextResponse.json(
      {
        message: "Đăng nhập thành công",
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
        },
        accessToken,
        refreshToken,
      },
      {
        status: 200,
      }
    );

    // Set cookies
    return setTokenCookies(response, accessToken, refreshToken);
  } catch (error) {
    console.error("Error logging in:", error);
    return NextResponse.json(
      { message: "Đăng nhập thất bại" },
      { status: 500 }
    );
  }
}
