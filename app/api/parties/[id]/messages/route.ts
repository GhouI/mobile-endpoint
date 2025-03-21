import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Message } from '@/models/Message';
import { Party } from '@/models/Party';
import { verifyToken } from '@/lib/jwt';
import { headers } from 'next/headers';

// Get messages for a party
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.pathname.split('/')[3]; // Get party ID from URL
    const { searchParams } = new URL(request.url);
    const isPrivate = searchParams.get('private') === 'true';
    const recipient = searchParams.get('recipient');

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
    await connectToDatabase();

    // Verify party exists and user is a participant
    const party = await Party.findById(id);
    if (!party) {
      return NextResponse.json(
        { error: 'Party not found' },
        { status: 404 }
      );
    }

    if (!party.participants.includes(userId)) {
      return NextResponse.json(
        { error: 'You are not a participant of this party' },
        { status: 403 }
      );
    }

    // Build query
    const query: any = {
      party: id,
      isPrivate,
    };

    if (isPrivate) {
      if (!recipient) {
        return NextResponse.json(
          { error: 'Recipient is required for private messages' },
          { status: 400 }
        );
      }
      query.$or = [
        { sender: userId, recipient },
        { sender: recipient, recipient: userId },
      ];
    }

    const messages = await Message.find(query)
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

// Send a message
export async function POST(request: NextRequest) {
  try {
    const id = request.nextUrl.pathname.split('/')[3]; // Get party ID from URL
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
    const { content, recipientId } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Verify party exists and user is a participant
    const party = await Party.findById(id);
    if (!party) {
      return NextResponse.json(
        { error: 'Party not found' },
        { status: 404 }
      );
    }

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
      party: id,
      recipient: recipientId,
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