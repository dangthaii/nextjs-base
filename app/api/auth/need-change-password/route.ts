import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { changePasswordApiSchema } from "@/schemas/auth";
import { handleValidationError } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import {
  verifyJWT,
  generateTokens,
  setTokenCookies,
  getToken,
} from "@/utils/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = await getToken();
    const payload = await verifyJWT(token);

    // Validate request body using shared schema
    const validationResult = changePasswordApiSchema.safeParse(body);
    handleValidationError(validationResult);

    const { password } = validationResult.data!;

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: payload?.sub },
    });

    if (!user) {
      return NextResponse.json(
        { message: "Người dùng không tồn tại" },
        { status: 404 }
      );
    }

    // Check if user needs to change password
    if (!user.needChangePassword) {
      return NextResponse.json(
        { message: "Không cần thay đổi mật khẩu" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user's password and reset needChangePassword flag
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        needChangePassword: false,
      },
    });

    // Generate new tokens
    const { accessToken, refreshToken } = await generateTokens(user.id);

    const response = NextResponse.json(
      {
        message: "Đổi mật khẩu thành công",
      },
      { status: 200 }
    );

    // Set new tokens in cookies
    return setTokenCookies(response, accessToken, refreshToken);
  } catch (error) {
    console.error("Error changing password:", error);
    return NextResponse.json(
      { message: "Đổi mật khẩu thất bại" },
      { status: 500 }
    );
  }
}
