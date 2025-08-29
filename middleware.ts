import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRefreshToken, getToken, verifyJWT } from "./utils/auth";

const protectedRoutes = ["/"];
const publicRoutes = [
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
];

let navigateCaseRefreshToken = false;

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const isApi = path.startsWith("/api");
  const isProtectedRoute = protectedRoutes.includes(path);
  const isPublicRoute = publicRoutes.includes(path);

  const response = NextResponse.next();

  const token = await getToken();
  const refreshToken = await getRefreshToken();

  const payload = (await verifyJWT(token || "")) as any;

  if (isApi && !isPublicRoute && !payload) {
    return NextResponse.json(
      { message: "Unauthorized", code: "TRY_REFRESH_TOKEN" },
      { status: 401 }
    );
  }

  if (isProtectedRoute) {
    if (!payload) {
      if (refreshToken && !navigateCaseRefreshToken) {
        navigateCaseRefreshToken = true;
        return NextResponse.redirect(new URL("/", request.url));
      }

      if (!refreshToken) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    } else {
      if (payload.needChangePassword) {
        return NextResponse.redirect(
          new URL("/need-change-password", request.url)
        );
      }
    }
  }

  return response;
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
