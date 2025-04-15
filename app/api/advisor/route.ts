import { NextResponse, type NextRequest } from 'next/server';
import OpenAI from 'openai';
import { connectToDatabase } from '@/lib/mongodb';
import { AdvisorMessage } from '@/models/AdvisorMessage';
import { verifyToken } from '@/lib/jwt';
import { headers } from 'next/headers';

// Create OpenAI client with timeout configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
// Define proper types for better type safety
interface TokenPayload {
  userId: string;
  [key: string]: any; // For any additional fields in the token
}

interface RequestBody {
  message?: string;
  limit?: number;
}

interface MessageDocument {
  _id: string;
  user: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  createdAt: Date;
  [key: string]: any;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `You are an expert travel advisor with extensive knowledge of global destinations, local customs, and travel planning. Your role is to help users plan their trips and provide personalized travel recommendations.

Key responsibilities:
1. Provide personalized travel recommendations based on users' interests, budget, and preferences
2. Share insider knowledge about destinations, including hidden gems and local favorites
3. Offer practical advice about transportation, accommodation, and local customs
4. Help users understand cultural norms and etiquette
5. Suggest activities and experiences that match the party's interests
6. Provide safety tips and travel precautions when relevant
7. Help with budget planning and cost estimates
8. Recommend local food and dining experiences
9. Suggest optimal travel times and seasonal considerations
10. Help coordinate group activities and party planning

When providing advice:
- Be specific and detailed in your recommendations
- Consider the group size and dynamics
- Factor in accessibility and practical constraints
- Include both popular attractions and off-the-beaten-path options
- Provide context about local culture and customs
- Be mindful of different budget levels
- Consider safety and comfort factors
- Include time estimates for activities
- Suggest alternatives when relevant
- Provide tips for group coordination

Important: Keep responses concise and focused, especially for popular destinations like Spain, to prevent timeouts.

Remember: Your goal is to help users create memorable and well-planned travel experiences while being mindful of practical considerations and group dynamics.`;

export async function POST(request: NextRequest) {
  let dbConnection = false;
  
  try {
    // Get authentication token from headers
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify token with proper error handling
    let userId: string;
    try {
      const decoded = verifyToken(token) as TokenPayload;
      if (!decoded || !decoded.userId) {
        throw new Error('Invalid token payload');
      }
      userId = decoded.userId;
    } catch (tokenError) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 403 }
      );
    }

    // Get request body with validation
    const body = await request.json().catch(() => ({} as RequestBody));
    const { message, limit = 5 } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Connect to database with timeout
    try {
      await connectToDatabase();
      dbConnection = true;
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 503 }
      );
    }

    // Get previous messages for the user
    const previousMessages = await AdvisorMessage.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    // Convert to MessageDocument type safely
    const typedMessages: MessageDocument[] = previousMessages.map((msg: any) => ({
      _id: msg._id.toString(),
      user: msg.user,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt,
    }));

    // Format conversation history for API
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...previousMessages.reverse().map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    // Call OpenAI with timeout handling
    const completionPromise = openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
    });
    
    // Define timeout with type casting to avoid Promise race type errors
    const timeoutPromise: Promise<never> = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('OpenAI API timeout')), 25000)
    );
    
    const completion = await Promise.race([completionPromise, timeoutPromise]);
    
    // Ensure the reply exists to satisfy TypeScript
    if (!completion.choices[0]?.message?.content) {
      throw new Error('Invalid response from OpenAI API');
    }
    
    const reply = completion.choices[0].message.content;

    // Save messages in a transaction if possible, or use Promise.all as fallback
    const savePromises = [
      // Save user message
      AdvisorMessage.create({
        user: userId,
        role: 'user' as const,
        content: message,
      }),
      // Save assistant message
      AdvisorMessage.create({
        user: userId,
        role: 'assistant' as const,
        content: reply,
      })
    ];
    
    await Promise.all(savePromises);

    // Create properly typed history objects
    const historyMessages = [
      ...previousMessages.reverse(),
      { 
        _id: 'temp-user-msg', 
        user: userId, 
        role: 'user' as const, 
        content: message,
        createdAt: new Date()
      },
      { 
        _id: 'temp-assistant-msg', 
        user: userId, 
        role: 'assistant' as const, 
        content: reply,
        createdAt: new Date()
      }
    ];

    // Return only the necessary data to improve response time
    return NextResponse.json({
      message: reply,
      history: historyMessages
    });
    
  } catch (error: unknown) {
    console.error('Advisor error:', error);
    
    // Only connect to database if we haven't already
    if (!dbConnection) {
      try {
        await connectToDatabase();
      } catch (dbError) {
        console.error('Failed to connect to database during error handling:', dbError);
      }
    }

    // Better error handling with type checking
    if (error instanceof Error) {
      // Handle timeouts
      if (error.message.includes('timeout') || error.message.includes('timed out')) {
        return NextResponse.json(
          { error: 'Request timed out. Please try a more specific question or break it into smaller parts.' },
          { status: 504 }
        );
      }
      
      // Handle rate limits
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Service temporarily unavailable. Please try again in a few minutes.' },
          { status: 429 }
        );
      }
      
      // Other OpenAI-specific errors
      if (error.message.includes('openai')) {
        return NextResponse.json(
          { error: 'AI service temporarily unavailable. Please try again later.' },
          { status: 502 }
        );
      }
    }

    // Generic error as fallback
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: process.env.NODE_ENV === 'development' ? 
          (error instanceof Error ? error.message : 'Unknown error') : 
          undefined
      },
      { status: 500 }
    );
  }
}

// Get conversation history with improved error handling
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Cap maximum limit
    
    // Add authentication check for GET method too
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify token
    const { userId } = verifyToken(token);

    await connectToDatabase();

    // Get messages with projection to limit returned fields
    const messages = await AdvisorMessage.find({ user: userId }, 'role content createdAt user')
      .sort({ createdAt: 1 }) // Chronological order
      .limit(limit)
      .populate('user', 'username profilePhoto')
      .lean()
      .exec();

    // Use countDocuments with a timeout to prevent long-running queries
    const countPromise = new Promise<number>((resolve) => {
      const timeoutId = setTimeout(() => resolve(-1), 3000); // 3-second timeout
      AdvisorMessage.countDocuments({ user: userId }).then(count => {
        clearTimeout(timeoutId);
        resolve(count);
      }).catch(() => {
        clearTimeout(timeoutId);
        resolve(-1);
      });
    });

    const total = await countPromise;

    return NextResponse.json({
      messages,
      total: total >= 0 ? total : messages.length, // Fallback if count timed out
    });
  } catch (error: unknown) {
    console.error('Get conversation history error:', error);
    return NextResponse.json(
      { error: 'Could not retrieve conversation history. Please try again.' },
      { status: 500 }
    );
  }
}
