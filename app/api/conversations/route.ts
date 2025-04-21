import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Message } from '@/models/Message';
import { Party } from '@/models/Party';
import { verifyToken } from '@/lib/jwt';
import { headers } from 'next/headers';

// Get all private messages sent to the user (DMs)
export async function GET(request: NextRequest) {
  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { userId } = verifyToken(token);
    await connectToDatabase();

    // Get all private messages where this user is the recipient
    const messages = await Message.find({
      isPrivate: true,
      recipient: userId
    })
      .populate('sender', 'username profilePhoto')
      .populate('party', 'description')
      .sort({ createdAt: -1 });

    // Group by sender
    const conversations = messages.reduce((acc: any, message: any) => {
      const senderId = (message.sender as any)._id.toString();
      if (!acc[senderId]) {
        acc[senderId] = { participant: message.sender, party: message.party, messages: [] };
      }
      acc[senderId].messages.push(message);
      return acc;
    }, {});

    return NextResponse.json({ conversations: Object.values(conversations) });
  } catch (error) {
    console.error('Get private DMs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Send a private message (DM) to another user (no party context required)
export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { userId } = verifyToken(token);
    await connectToDatabase();

    const { content, recipientId } = await request.json();
    if (!content || !recipientId) {
      return NextResponse.json({ error: 'content and recipientId are required' }, { status: 400 });
    }

    const created = await Message.create({
      content,
      sender: userId,
      recipient: recipientId,
      isPrivate: true
    });

    const populatedMessage = await Message.findById(created._id)
      .populate('sender', 'username profilePhoto')
      .populate('recipient', 'username profilePhoto');

    return NextResponse.json({ message: populatedMessage }, { status: 201 });
  } catch (error) {
    console.error('Send DM error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
