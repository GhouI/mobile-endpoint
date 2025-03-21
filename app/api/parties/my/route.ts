import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Party } from '@/models/Party';
import { verifyToken } from '@/lib/jwt';
import { headers } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'created', 'joined', or null for both

    // Connect to database
    await connectToDatabase();

    // Build query based on type
    let query = {};
    if (type === 'created') {
      query = { owner: userId };
    } else if (type === 'joined') {
      query = {
        participants: userId,
        owner: { $ne: userId } // Exclude parties where user is owner
      };
    } else {
      // If no type specified, get all parties where user is either owner or participant
      query = {
        $or: [
          { owner: userId },
          { participants: userId }
        ]
      };
    }

    // Find parties
    const parties = await Party.find(query)
      .populate('owner', 'username profilePhoto')
      .populate('participants', 'username profilePhoto')
      .sort({ createdAt: -1 });

    // Group parties by type
    const createdParties = parties.filter(party => party.owner._id.toString() === userId);
    const joinedParties = parties.filter(party => party.owner._id.toString() !== userId);

    return NextResponse.json({
      created: createdParties,
      joined: joinedParties,
      total: parties.length
    });
  } catch (error) {
    console.error('Get my parties error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 