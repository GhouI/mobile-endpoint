import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
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
        { 
          error: 'Authentication required',
          details: 'No authentication token provided in the Authorization header',
          code: 'AUTH_REQUIRED'
        },
        { status: 401 }
      );
    }

    let userId: string;
    try {
      const decoded = verifyToken(token);
      if (!decoded || !decoded.userId) {
        throw new Error('Invalid token payload');
      }
      userId = decoded.userId;
    } catch (err) {
      return NextResponse.json(
        { 
          error: 'Invalid authentication token',
          details: 'The provided token is either expired, malformed, or invalid',
          code: 'INVALID_TOKEN'
        },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const party = await Party.findById(id);
    if (!party) {
      return NextResponse.json(
        { 
          error: 'Party not found',
          details: `No party exists with ID: ${id}`,
          code: 'PARTY_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Check if party is full or closed
    if (party.status === 'full') {
      return NextResponse.json(
        { 
          error: 'Cannot join party',
          details: 'The party has reached its maximum number of participants',
          code: 'PARTY_FULL',
          maxParticipants: party.maxParticipants,
          currentParticipants: party.currentParticipants
        },
        { status: 400 }
      );
    }

    if (party.status === 'closed') {
      return NextResponse.json(
        { 
          error: 'Cannot join party',
          details: 'The party is no longer accepting new participants',
          code: 'PARTY_CLOSED'
        },
        { status: 400 }
      );
    }

    // Check if user is already a participant
    if (party.participants.includes(userId)) {
      return NextResponse.json(
        { 
          error: 'Cannot join party',
          details: 'You are already a participant of this party',
          code: 'ALREADY_PARTICIPANT'
        },
        { status: 400 }
      );
    }

    // Add user to participants and increment count
    party.participants.push(userId);
    party.currentParticipants += 1;

    // Check if party is now full after adding the new participant
    if (party.currentParticipants >= party.maxParticipants) {
      party.status = 'full';
    }

    await party.save();

    const updatedParty = await Party.findById(id)
      .populate('owner', 'username profilePhoto')
      .populate('participants', 'username profilePhoto');

    return NextResponse.json({
      message: 'Successfully joined the party',
      party: updatedParty,
      details: {
        newParticipantCount: updatedParty.currentParticipants,
        partyStatus: updatedParty.status
      }
    });
  } catch (error) {
    console.error('Join party error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: 'An unexpected error occurred while processing your request. Error:',
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
        code: 'INTERNAL_ERROR'
      },
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
        { 
          error: 'Authentication required',
          details: 'No authentication token provided in the Authorization header',
          code: 'AUTH_REQUIRED'
        },
        { status: 401 }
      );
    }

    let userId: string;
    try {
      const decoded = verifyToken(token);
      if (!decoded || !decoded.userId) {
        throw new Error('Invalid token payload');
      }
      userId = decoded.userId;
    } catch (err) {
      return NextResponse.json(
        { 
          error: 'Invalid authentication token',
          details: 'The provided token is either expired, malformed, or invalid',
          code: 'INVALID_TOKEN'
        },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const party = await Party.findById(id);
    if (!party) {
      return NextResponse.json(
        { 
          error: 'Party not found',
          details: `No party exists with ID: ${id}`,
          code: 'PARTY_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Check if user is a participant
    if (!party.participants.includes(userId)) {
      return NextResponse.json(
        { 
          error: 'Cannot leave party',
          details: 'You are not a participant of this party',
          code: 'NOT_PARTICIPANT'
        },
        { status: 400 }
      );
    }

    // Check if user is the owner
    if (party.owner.toString() === userId) {
      return NextResponse.json(
        { 
          error: 'Cannot leave party',
          details: 'Party owners cannot leave their own party. Please delete the party instead.',
          code: 'OWNER_CANNOT_LEAVE'
        },
        { status: 400 }
      );
    }

    // Remove user from participants and decrement count
    party.participants = party.participants.filter(
      (p: Types.ObjectId) => p.toString() !== userId
    );
    party.currentParticipants -= 1;

    // Update party status if it was full
    if (party.status === 'full' && party.currentParticipants < party.maxParticipants) {
      party.status = 'open';
    }

    await party.save();

    const updatedParty = await Party.findById(id)
      .populate('owner', 'username profilePhoto')
      .populate('participants', 'username profilePhoto');

    return NextResponse.json({
      message: 'Successfully left the party',
      party: updatedParty,
      details: {
        newParticipantCount: updatedParty.currentParticipants,
        partyStatus: updatedParty.status
      }
    });
  } catch (error) {
    console.error('Leave party error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: 'An unexpected error occurred while processing your request',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
} 