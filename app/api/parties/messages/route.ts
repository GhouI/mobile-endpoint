import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Message } from '@/models/Message';
import { Party } from '@/models/Party';
import { verifyToken } from '@/lib/jwt';
import { headers } from 'next/headers';

// Get messages for a party
export async function GET(request: NextRequest) {
  try {
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
    const body = await request.json();
    const { partyId } = body;

    if (!partyId) {
      return NextResponse.json(
        { error: 'Party ID is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Verify party exists
    const party = await Party.findById(partyId);
    if (!party) {
      return NextResponse.json(
        { error: 'Party not found' },
        { status: 404 }
      );
    }

    // Check if user is a participant
    if (!party.participants.includes(userId)) {
      return NextResponse.json(
        { error: 'You are not a participant of this party' },
        { status: 403 }
      );
    }

    // Get all messages for the party
    const messages = await Message.find({ party: partyId })
      .populate('sender', 'username profilePhoto')
      .populate('recipient', 'username profilePhoto')
      .sort({ createdAt: 1 });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Send a message to a party
export async function POST(request: NextRequest) {
  try {
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
    const { partyId, content, userId: recipientId } = await request.json();

    if (!partyId) {
      return NextResponse.json(
        { error: 'Party ID is required' },
        { status: 400 }
      );
    }

    if (!content) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Verify party exists
    const party = await Party.findById(partyId);
    if (!party) {
      return NextResponse.json(
        { error: 'Party not found' },
        { status: 404 }
      );
    }

    // Check if user is a participant
    if (!party.participants.includes(userId)) {
      return NextResponse.json(
        { error: 'You are not a participant of this party' },
        { status: 403 }
      );
    }

    // Create message
    const message = await Message.create({
      content,
      sender: userId,
      party: partyId,
      recipient: recipientId || undefined,
      isPrivate: !!recipientId,
    });

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'username profilePhoto')
      .populate('recipient', 'username profilePhoto');

    return NextResponse.json({
      status: 'Message sent successfully',
      data: populatedMessage,
    });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
