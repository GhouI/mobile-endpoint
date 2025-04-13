import { NextResponse, type NextRequest } from 'next/server';
import OpenAI from 'openai';
import { connectToDatabase } from '@/lib/mongodb';
import { AdvisorMessage } from '@/models/AdvisorMessage';
import { verifyToken } from '@/lib/jwt';
import { headers } from 'next/headers';

// Create OpenAI client with timeout configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30 second timeout
  maxRetries: 2, // Limit retries to prevent long-hanging requests
});

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
    // Get authentication token
    const headersList = headers();
    const authHeader = headersList.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify token with proper error handling
    let userId;
    try {
      const decoded = verifyToken(token);
      userId = decoded.userId;
    } catch (tokenError) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 403 }
      );
    }

    // Get request body with validation
    const body = await request.json().catch(() => ({}));
    const { message, partyId, limit = 5 } = body; // Reduced default limit

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

    // Build query based on parameters
    const query = partyId 
      ? { partyId, user: userId }
      : { user: userId };

    // Get previous messages with a reasonable limit
    const previousMessages = await AdvisorMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    // Check if the message contains keywords about Spain to adjust settings
    const isSpainQuery = message.toLowerCase().includes('spain') || 
                         message.toLowerCase().includes('barcelona') || 
                         message.toLowerCase().includes('madrid');
    
    // Format conversation history for ChatGPT
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...previousMessages.reverse().map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    // Adjust parameters for Spain-related queries to prevent timeouts
    const maxTokens = isSpainQuery ? 600 : 1000;
    const temperature = isSpainQuery ? 0.5 : 0.7;

    // Call ChatGPT with timeout handling
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI API timeout')), 25000)
      )
    ]);

    // @ts-ignore - Handle the race promise result
    const reply = completion.choices[0].message.content;

    // Batch save operations to reduce database overhead
    await Promise.all([
      // Save user message
      AdvisorMessage.create({
        user: userId,
        partyId,
        role: 'user',
        content: message,
      }),
      // Save assistant message
      AdvisorMessage.create({
        user: userId,
        partyId,
        role: 'assistant',
        content: reply,
      })
    ]);

    // Get updated conversation history (optional - can be removed if causing performance issues)
    const updatedMessages = await AdvisorMessage.find(query)
      .sort({ createdAt: 1 }) // Sort in chronological order
      .limit(limit)
      .lean()
      .exec();

    return NextResponse.json({
      message: reply,
      history: updatedMessages,
    });
  } catch (error: unknown) {
    console.error('Advisor error:', error);
    
    // Clean up database connection if needed
    if (!dbConnection) {
      try {
        await connectToDatabase();
      } catch (dbError) {
        console.error('Failed to connect to database during error handling:', dbError);
      }
    }

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('timed out')) {
        return NextResponse.json(
          { error: 'Request timed out. Please try a more specific question or break it into smaller parts.' },
          { status: 504 }
        );
      }
      
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Service temporarily unavailable. Please try again in a few minutes.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { 
        error: 'Service temporarily unavailable',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Get conversation history with improved error handling
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get('partyId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Cap maximum limit
    
    // Add authentication check for GET method too
    const headersList = headers();
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

    // Build query including user check
    const query = partyId 
      ? { partyId, user: userId }
      : { user: userId };

    // Get messages with projection to limit returned fields
    const messages = await AdvisorMessage.find(query, 'role content createdAt user partyId')
      .sort({ createdAt: 1 }) // Chronological order
      .limit(limit)
      .populate('user', 'username profilePhoto')
      .lean()
      .exec();

    // Use countDocuments with a timeout to prevent long-running queries
    const countPromise = new Promise<number>((resolve) => {
      const timeoutId = setTimeout(() => resolve(-1), 3000); // 3-second timeout
      AdvisorMessage.countDocuments(query).then(count => {
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
  } catch (error) {
    console.error('Get conversation history error:', error);
    return NextResponse.json(
      { error: 'Could not retrieve conversation history. Please try again.' },
      { status: 500 }
    );
  }
}
