import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // Allow root path to be accessible without authentication (selection page)
    if (req.nextUrl.pathname === "/") {
      return NextResponse.next();
    }
    // Add custom middleware logic here if needed
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow root path without authentication
        if (req.nextUrl.pathname === "/") {
          return true;
        }
        return !!token;
      },
    },
    pages: {
      signIn: "/sign-in",
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth routes)
     * - api/auth/signup (signup route)
     * - api/exercise-catalog/seed (public seed endpoint)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - sign-in, sign-up, coach-signup, member-signup, forgot-password (auth pages)
     * - public files (images, etc.)
     */
    "/((?!api/auth|api/exercise-catalog/seed|_next/static|_next/image|favicon.ico|sign-in|sign-up|coach-signup|member-signup|forgot-password|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
