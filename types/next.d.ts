declare module 'next/server' {
  export interface NextRequest extends Request {
    nextUrl: URL;
  }
  
  export class NextResponse extends Response {
    static json(body: any, init?: ResponseInit): NextResponse;
  }
} 