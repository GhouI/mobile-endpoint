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

// Send a private message (DM) to another user
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

    const { content, recipientId, partyId } = await request.json();
    if (!content || !recipientId || !partyId) {
      return NextResponse.json({ error: 'content, recipientId, and partyId are required' }, { status: 400 });
    }

    // Validate party exists and user is a participant or owner
    const party = await Party.findById(partyId);
    if (!party) {
      return NextResponse.json({ error: 'Party not found' }, { status: 404 });
    }
    const isParticipant = party.participants.some((p: any) => p.toString() === userId) || party.owner.toString() === userId;
    if (!isParticipant) {
      return NextResponse.json({ error: 'You are not a participant of this party' }, { status: 403 });
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
      .populate('recipient', 'username profilePhoto')
      .populate('party', 'description');

    return NextResponse.json({ message: populatedMessage }, { status: 201 });
  } catch (error) {
    console.error('Send DM error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
