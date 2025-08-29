import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { registerApiSchema } from "@/schemas/auth";
import { handleValidationError } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { generateTokens } from "@/utils/auth";
// import your database/ORM here

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body using shared schema
    const validationResult = registerApiSchema.safeParse(body);
    handleValidationError(validationResult);

    const data = validationResult.data!;
    const { registerCode, username, name, password } = data;

    // Validate register code
    const validRegisterCode = process.env.REGISTER_CODE;
    if (!registerCode || registerCode !== validRegisterCode) {
      return NextResponse.json(
        { message: "Mã đăng ký không hợp lệ" },
        { status: 403 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "Tên đăng nhập này đã được sử dụng" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        username,
        name,
        password: hashedPassword,
        needChangePassword: true,
      },
    });

    const { accessToken, refreshToken } = await generateTokens(user.id);

    const response = NextResponse.json(
      {
        message: "Đăng ký thành công",
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
        },
        accessToken,
        refreshToken,
      },
      {
        status: 201,
      }
    );

    return response;
  } catch (error) {
    console.error("Error registering user:", error);
    return NextResponse.json(
      { message: "Đăng ký thất bại. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}
