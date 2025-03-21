import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Party } from '@/models/Party';
import { verifyToken } from '@/lib/jwt';
import { headers } from 'next/headers';
import { Types } from 'mongoose';

// Join party
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
    await connectToDatabase();

    const party = await Party.findById(id);
    if (!party) {
      return NextResponse.json(
        { error: 'Party not found' },
        { status: 404 }
      );
    }

    // Check if party is full or closed
    if (party.status === 'full' || party.status === 'closed') {
      return NextResponse.json(
        { error: `Cannot join party: party is ${party.status}` },
        { status: 400 }
      );
    }

    // Check if user is already a participant
    if (party.participants.includes(userId)) {
      return NextResponse.json(
        { error: 'You are already a participant' },
        { status: 400 }
      );
    }

    // Add user to participants and increment count
    party.participants.push(userId);
    party.currentParticipants += 1;
    await party.save();

    const updatedParty = await Party.findById(id)
      .populate('owner', 'username profilePhoto')
      .populate('participants', 'username profilePhoto');

    return NextResponse.json({
      message: 'Successfully joined the party',
      party: updatedParty,
    });
  } catch (error) {
    console.error('Join party error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Leave party
export async function DELETE(request: NextRequest) {
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
    await connectToDatabase();

    const party = await Party.findById(id);
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
        { status: 400 }
      );
    }

    // Check if user is the owner
    if (party.owner.toString() === userId) {
      return NextResponse.json(
        { error: 'Party owner cannot leave the party. Delete the party instead.' },
        { status: 400 }
      );
    }

    // Remove user from participants and decrement count
    party.participants = party.participants.filter(
      (p: Types.ObjectId) => p.toString() !== userId
    );
    party.currentParticipants -= 1;
    await party.save();

    const updatedParty = await Party.findById(id)
      .populate('owner', 'username profilePhoto')
      .populate('participants', 'username profilePhoto');

    return NextResponse.json({
      message: 'Successfully left the party',
      party: updatedParty,
    });
  } catch (error) {
    console.error('Leave party error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 