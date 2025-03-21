import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Party } from '@/models/Party';
import { verifyToken } from '@/lib/jwt';
import { headers } from 'next/headers';

// Create party
export async function POST(request: NextRequest) {
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

    // Get request body
    const {
      location,
      description,
      estimatedPrice,
      maxParticipants,
      imageUrl,
      additionalFields,
      isGlobal,
      latitude,
      longitude,
    } = await request.json();

    // Validate required fields
    if (!location || !description || estimatedPrice == null || !maxParticipants) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate coordinates for local parties
    if (!isGlobal && (!latitude || !longitude)) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required for local parties' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Create party with coordinates if local
    const partyData: any = {
      location,
      description,
      estimatedPrice,
      maxParticipants,
      owner: userId,
      participants: [userId],
      imageUrl,
      additionalFields: additionalFields || {},
      isGlobal,
    };

    // Add coordinates for local parties
    if (!isGlobal) {
      partyData.coordinates = {
        type: 'Point',
        coordinates: [longitude, latitude], // MongoDB expects [longitude, latitude]
      };
    }

    const party = await Party.create(partyData);

    return NextResponse.json({
      message: 'Party created successfully',
      party: await Party.findById(party._id)
        .populate('owner', 'username profilePhoto')
        .populate('participants', 'username profilePhoto'),
    });
  } catch (error) {
    console.error('Create party error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Search parties
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location');
    const maxPrice = searchParams.get('maxPrice');
    const status = searchParams.get('status');
    const isGlobal = searchParams.get('isGlobal') === 'true';
    const latitude = searchParams.get('latitude');
    const longitude = searchParams.get('longitude');
    const maxDistance = searchParams.get('maxDistance') || '50'; // Default 50km radius

    // Connect to database
    await connectToDatabase();

    // Build query
    const query: any = {};
    
    // Add global/local filter
    query.isGlobal = isGlobal;

    // Add location-based search for local parties
    if (!isGlobal && latitude && longitude) {
      query.coordinates = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: parseInt(maxDistance) * 1000, // Convert km to meters
        },
      };
    }

    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }
    if (maxPrice) {
      query.estimatedPrice = { $lte: parseFloat(maxPrice) };
    }
    if (status) {
      query.status = status;
    }

    // Find parties
    const parties = await Party.find(query)
      .populate('owner', 'username profilePhoto')
      .populate('participants', 'username profilePhoto')
      .sort({ createdAt: -1 });

    return NextResponse.json({ 
      parties,
      filters: {
        isGlobal,
        maxDistance: isGlobal ? null : parseInt(maxDistance),
        location,
        maxPrice,
        status,
      }
    });
  } catch (error) {
    console.error('Search parties error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 