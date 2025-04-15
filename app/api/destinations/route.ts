import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Destination } from '@/models/Destination';

// Get all destinations or search by query
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const id = searchParams.get('id');

    await connectToDatabase();

    // If ID is provided, return single destination with full details
    if (id) {
      const destination = await Destination.findById(id);
      
      if (!destination) {
        return NextResponse.json(
          { error: 'Destination not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ destination });
    }

    // Build search query
    const searchQuery = query
      ? { $text: { $search: query } }
      : {};

    // Get destinations with short descriptions
    const destinations = await Destination.find(
      searchQuery,
      {
        name: 1,
        shortDescription: 1,
        bannerUrl: 1,
        weather: 1,
        currency: 1,
        languages: 1,
        attractions: { $slice: 3 }, // Only return first 3 attractions in list view
      }
    ).sort({ name: 1 });

    return NextResponse.json({
      destinations,
      total: await Destination.countDocuments(searchQuery),
    });
  } catch (error) {
    console.error('Get destinations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Create a new destination
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const requiredFields = [
      'name',
      'shortDescription',
      'longDescription',
      'bannerUrl',
      'weather',
      'currency',
      'languages',
      'attractions'
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    await connectToDatabase();

    // Check if destination with same name already exists
    const existingDestination = await Destination.findOne({ name: body.name });
    if (existingDestination) {
      return NextResponse.json(
        { error: 'A destination with this name already exists' },
        { status: 409 }
      );
    }

    const destination = await Destination.create(body);
    
    return NextResponse.json(
      { destination },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create destination error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 