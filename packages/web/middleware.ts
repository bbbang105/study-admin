import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/posts',
  '/curation',
  '/ranking',
  '/profile',
];

// Routes that require admin access
const adminRoutes = [
  '/admin',
];

// Routes that should redirect to dashboard if already logged in
const authRoutes = [
  '/login',
  '/register',
];

/**
 * Verify JWT token using jose library (Edge runtime compatible)
 */
async function verifyJWT(token: string): Promise<{ userId: string; email: string } | null> {
  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'development-secret-key-min-32-chars'
    );
    
    const { payload } = await jwtVerify(token, secret);
    
    return {
      userId: payload.userId as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

/**
 * Middleware for authentication and route protection
 * Requirement: 17.9
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Get auth token from cookie
  const authToken = request.cookies.get('auth-token')?.value;
  
  // Verify token if present
  let user: { userId: string; email: string } | null = null;
  if (authToken) {
    user = await verifyJWT(authToken);
  }
  
  // Check if token is expired (Requirement 17.9)
  const isAuthenticated = !!user;
  
  // Handle auth routes (login, register)
  if (authRoutes.some(route => pathname.startsWith(route))) {
    if (isAuthenticated) {
      // Redirect to dashboard if already logged in
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }
  
  // Handle protected routes
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      // Redirect to login if not authenticated
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    // Add user info to headers for downstream use
    const response = NextResponse.next();
    response.headers.set('x-user-id', user!.userId);
    response.headers.set('x-user-email', user!.email);
    return response;
  }
  
  // Handle admin routes
  if (adminRoutes.some(route => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      // Redirect to login if not authenticated
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    // Note: Admin check is done at the API/page level using Discord ID
    // The middleware just ensures the user is authenticated
    const response = NextResponse.next();
    response.headers.set('x-user-id', user!.userId);
    response.headers.set('x-user-email', user!.email);
    return response;
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handled separately)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|_next).*)',
  ],
};
