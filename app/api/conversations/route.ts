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

    // Get all private messages where this user is either the sender or recipient
    const messages = await Message.find({
      isPrivate: true,
      $or: [
        { recipient: userId },
        { sender: userId }
      ]
    })
      .populate('sender', 'username profilePhoto')
      .populate('recipient', 'username profilePhoto')
      .sort({ createdAt: -1 });

    // Group by conversation partner (either sender or recipient, depending on the message)
    const conversations = messages.reduce((acc: any, message: any) => {
      // Determine the conversation partner (the other person)
      const isSender = message.sender._id.toString() === userId;
      const partner = isSender ? message.recipient : message.sender;
      const partnerId = partner._id.toString();

      if (!acc[partnerId]) {
        acc[partnerId] = {
          participant: partner,
          messages: []
        };
      }
      acc[partnerId].messages.push(message);
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
