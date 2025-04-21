import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Message } from '@/models/Message';
import { Party } from '@/models/Party';
import { verifyToken } from '@/lib/jwt';
import { headers } from 'next/headers';

// Get conversations for party owner
export async function GET(request: NextRequest) {
  try {
    const partyId = request.nextUrl.pathname.split('/')[3];
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { userId } = verifyToken(token);
    await connectToDatabase();

    const party = await Party.findById(partyId);
    if (!party) {
      return NextResponse.json({ error: 'Party not found' }, { status: 404 });
    }

    if (party.owner.toString() !== userId) {
      return NextResponse.json({ error: 'Only party owner can view private messages' }, { status: 403 });
    }

    // Fetch private messages sent to owner
    const messages = await Message.find({
      party: partyId,
      isPrivate: true,
      recipient: userId
    })
      .populate('sender', 'username profilePhoto')
      .sort({ createdAt: -1 });

    // Group by sender
    const conversations = messages.reduce((acc: any, message: any) => {
      const senderId = (message.sender as any)._id.toString();
      if (!acc[senderId]) {
        acc[senderId] = { participant: message.sender, messages: [] };
      }
      acc[senderId].messages.push(message);
      return acc;
    }, {});

    return NextResponse.json({ conversations: Object.values(conversations) });
  } catch (error) {
    console.error('Get private messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Reply to a private conversation as party owner
export async function POST(request: NextRequest) {
  try {
    const partyId = request.nextUrl.pathname.split('/')[3];
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { userId } = verifyToken(token);
    await connectToDatabase();

    const party = await Party.findById(partyId);
    if (!party) {
      return NextResponse.json({ error: 'Party not found' }, { status: 404 });
    }

    if (party.owner.toString() !== userId) {
      return NextResponse.json({ error: 'Only party owner can send private messages' }, { status: 403 });
    }

    const { content, recipientId } = await request.json();
    if (!content || !recipientId) {
      return NextResponse.json({ error: 'Content and recipientId are required' }, { status: 400 });
    }

    const created = await Message.create({
      content,
      sender: userId,
      recipient: recipientId,
      party: partyId,
      isPrivate: true
    });

    const populatedMessage = await created
      .populate('sender', 'username profilePhoto')
      .populate('recipient', 'username profilePhoto');

    return NextResponse.json({ message: populatedMessage }, { status: 201 });
  } catch (error) {
    console.error('Reply to private message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
