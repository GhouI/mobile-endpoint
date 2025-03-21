import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Party } from '@/models/Party';
import { verifyToken } from '@/lib/jwt';
import { headers } from 'next/headers';

// Get party details
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.pathname.split('/')[3]; // Get party ID from URL
    await connectToDatabase();

    const party = await Party.findById(id)
      .populate('owner', 'username profilePhoto')
      .populate('participants', 'username profilePhoto');

    if (!party) {
      return NextResponse.json(
        { error: 'Party not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ party });
  } catch (error) {
    console.error('Get party error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Update party
export async function PATCH(request: NextRequest) {
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
    const updates = await request.json();

    await connectToDatabase();

    const party = await Party.findById(id);
    if (!party) {
      return NextResponse.json(
        { error: 'Party not found' },
        { status: 404 }
      );
    }

    // Check if user is the owner
    if (party.owner.toString() !== userId) {
      return NextResponse.json(
        { error: 'Only the party owner can update the party' },
        { status: 403 }
      );
    }

    // Validate updates
    const allowedUpdates = [
      'location',
      'description',
      'estimatedPrice',
      'maxParticipants',
      'imageUrl',
      'additionalFields',
      'status'
    ];

    const updateKeys = Object.keys(updates);
    const isValidOperation = updateKeys.every(key => allowedUpdates.includes(key));

    if (!isValidOperation) {
      return NextResponse.json(
        { error: 'Invalid updates' },
        { status: 400 }
      );
    }

    // Apply updates
    Object.assign(party, updates);
    await party.save();

    const updatedParty = await Party.findById(id)
      .populate('owner', 'username profilePhoto')
      .populate('participants', 'username profilePhoto');

    return NextResponse.json({
      message: 'Party updated successfully',
      party: updatedParty,
    });
  } catch (error) {
    console.error('Update party error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Delete party
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

    // Check if user is the owner
    if (party.owner.toString() !== userId) {
      return NextResponse.json(
        { error: 'Only the party owner can delete the party' },
        { status: 403 }
      );
    }

    await Party.findByIdAndDelete(id);

    return NextResponse.json({
      message: 'Party deleted successfully'
    });
  } catch (error) {
    console.error('Delete party error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 