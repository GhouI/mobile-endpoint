import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/jwt';
import { openai } from '@/lib/openai';
import { AdvisorMessage } from '@/models/AdvisorMessage';

const SYSTEM_PROMPT = `You are a helpful travel advisor. Provide concise, accurate, and practical travel advice. 
Focus on specific recommendations, safety tips, and local insights. 
Keep responses clear and actionable.`;

interface RequestBody {
  message: string;
}

interface TokenPayload {
  userId: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Get conversation history
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { userId } = verifyToken(token) as TokenPayload;
    await connectToDatabase();

    const messages = await AdvisorMessage.find({ user: userId })
      .sort({ createdAt: 1 });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Get conversation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Send message and get response
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { userId } = verifyToken(token) as TokenPayload;
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Store user message
    await AdvisorMessage.create({
      user: userId,
      role: 'user',
      content: message,
    });

    // Get conversation history
    const history = await AdvisorMessage.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10);

    // Format conversation for API
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.reverse().map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    ];

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages,
    });

    const reply = completion.choices[0]?.message?.content;
    if (!reply) {
      throw new Error('Invalid response from OpenAI API');
    }

    // Store assistant response
    await AdvisorMessage.create({
      user: userId,
      role: 'assistant',
      content: reply,
    });

    return NextResponse.json({ message: reply });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Clear conversation history
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { userId } = verifyToken(token) as TokenPayload;
    await connectToDatabase();

    await AdvisorMessage.deleteMany({ user: userId });

    return NextResponse.json({ message: 'Conversation history cleared successfully' });
  } catch (error) {
    console.error('Clear conversation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
