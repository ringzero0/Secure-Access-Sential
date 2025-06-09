
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';





export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  
  
  

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/static') || pathname.endsWith('.ico') || pathname.endsWith('.png')) {
    return NextResponse.next();
  }
  
  
  
  
  
  

  
  
  
  
  
  
  
  
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
