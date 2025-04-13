import { NextResponse, type NextRequest } from 'next/server';
import OpenAI from 'openai';
import { connectToDatabase } from '@/lib/mongodb';
import { AdvisorMessage } from '@/models/AdvisorMessage';
import { verifyToken } from '@/lib/jwt';
import { headers } from 'next/headers';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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

Remember: Your goal is to help users create memorable and well-planned travel experiences while being mindful of practical considerations and group dynamics.`;

export async function POST(request: NextRequest) {
  try {
    // Get authentication token
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { userId } = verifyToken(token);

    // Get request body
    const { message, partyId, limit = 10 } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Get previous messages from database
    const query = partyId 
      ? { partyId, user: userId }
      : { user: userId };

    const previousMessages = await AdvisorMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Format conversation history for ChatGPT
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...previousMessages.reverse().map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    // Call ChatGPT
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 1000,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    const reply = completion.choices[0].message.content;

    // Save user message
    await AdvisorMessage.create({
      user: userId,
      partyId,
      role: 'user',
      content: message,
    });

    // Save assistant message
    await AdvisorMessage.create({
      user: userId,
      partyId,
      role: 'assistant',
      content: reply,
    });

    // Get updated conversation history
    const updatedMessages = await AdvisorMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      message: reply,
      history: updatedMessages.reverse(),
    });
  } catch (error: unknown) {
    console.error('Advisor error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Get conversation history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get('partyId');
    const limit = parseInt(searchParams.get('limit') || '50');

    await connectToDatabase();

    // Build query
    const query = partyId 
      ? { partyId }
      : {};

    // Get messages
    const messages = await AdvisorMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('user', 'username profilePhoto')
      .lean();

    return NextResponse.json({
      messages: messages.reverse(),
      total: await AdvisorMessage.countDocuments(query),
    });
  } catch (error) {
    console.error('Get conversation history error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
