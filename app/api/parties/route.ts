import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Party } from '@/models'; // Updated import to use the index file
import { verifyToken } from '@/lib/jwt'; // Assuming verifyToken works as expected
import { headers } from 'next/headers';


export async function POST(request: NextRequest) {
  try {
    // --- Authentication ---
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      console.error('Create party error: Missing token');
      return NextResponse.json(
        { error: 'Authentication required' },
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
      console.error('Create party error: Invalid token', err);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // --- Request Body Parsing ---
    const body = await request.json();
    const {
      location,
      description,
      estimatedPrice: rawEstimatedPrice,
      maxParticipants: rawMaxParticipants,
      imageUrl,
      additionalFields,
      isGlobal = false, // Default to false if not provided (matches schema default)
      latitude: rawLatitude,
      longitude: rawLongitude,
    } = body;

    // --- Input Validation ---
    if (!location || !description || rawEstimatedPrice == null || rawMaxParticipants == null) {
       console.error('Create party error: Missing required fields', { location, description, rawEstimatedPrice, rawMaxParticipants });
      return NextResponse.json(
        { error: 'Missing required fields: location, description, estimatedPrice, maxParticipants' },
        { status: 400 }
      );
    }

    // Parse and validate numeric inputs
    const estimatedPrice = parseFloat(rawEstimatedPrice);
    const maxParticipants = parseInt(rawMaxParticipants, 10);

    // Check against schema constraints (min values)
    if (isNaN(estimatedPrice) || estimatedPrice < 0 || isNaN(maxParticipants) || maxParticipants < 1) {
       console.error('Create party error: Invalid numeric fields or below min values', { rawEstimatedPrice, rawMaxParticipants });
      return NextResponse.json(
        { error: 'estimatedPrice must be a non-negative number, maxParticipants must be a number greater than or equal to 1' },
        { status: 400 }
      );
    }

    let latitude: number | null = null;
    let longitude: number | null = null;

    // Validate and parse coordinates ONLY if it's a local party
    if (!isGlobal) {
      if (rawLatitude == null || rawLongitude == null) {
        console.error('Create party error: Missing coordinates for local party');
        return NextResponse.json(
          { error: 'Latitude and longitude are required for local parties' },
          { status: 400 }
        );
      }
      latitude = parseFloat(rawLatitude);
      longitude = parseFloat(rawLongitude);

      if (isNaN(latitude) || isNaN(longitude)) {
        console.error('Create party error: Invalid coordinates', { rawLatitude, rawLongitude });
        return NextResponse.json(
          { error: 'Latitude and longitude must be valid numbers' },
          { status: 400 }
        );
      }
    }

    // --- Database Connection ---
    await connectToDatabase();

    // --- Prepare Party Data (aligning with Schema) ---
    const partyData: any = {
      location,
      description,
      estimatedPrice,
      maxParticipants,
      owner: userId,
      participants: [userId], // Start with the owner as a participant
      currentParticipants: 1, // Explicitly set initial participant count
      imageUrl: imageUrl || undefined, // Use undefined if null/empty for cleaner DB entry
      additionalFields: additionalFields || {}, // Matches schema type Map/default
      isGlobal: !!isGlobal // Ensure boolean, matches schema required: true
    };

    // Handle coordinates based on party type
    if (!isGlobal && latitude !== null && longitude !== null) {
      partyData.coordinates = {
        type: 'Point',
        coordinates: [longitude, latitude] // MongoDB GeoJSON format: [longitude, latitude]
      };
    } else if (isGlobal) {
      // For global parties, explicitly set coordinates to null
      partyData.coordinates = null;
    }

    // --- Create Party in DB ---
    console.log('Attempting to create party with data:', partyData);
    const party = await Party.create(partyData); // create() triggers 'save' and the pre-save hook
    console.log('Party created successfully:', party._id);

    // --- Fetch Created Party with Population ---
    const populatedParty = await Party.findById(party._id)
      .populate('owner', 'username profilePhoto') // Adjust fields as needed in User model
      .populate('participants', 'username profilePhoto') // Adjust fields as needed
      .lean();

     if (!populatedParty) {
       console.error('Create party error: Failed to re-fetch created party', party._id);
       return NextResponse.json(
         { error: 'Party created but failed to retrieve details' },
         { status: 500 }
       );
     }

    // --- Success Response ---
    return NextResponse.json({
      message: 'Party created successfully',
      party: populatedParty, // Return the lean, populated object
    });

  } catch (error: any) {
    // --- Error Handling ---
    console.error('Create party error:', error);
    if (error.name === 'ValidationError') {
       // Mongoose validation error (e.g., required field missing not caught above, enum mismatch)
       return NextResponse.json(
         { error: 'Validation failed', details: error.errors },
         { status: 400 }
       );
    }
    // Generic error
    return NextResponse.json(
      { error: 'Internal server error while creating party' },
      { status: 500 }
    );
  }
}

// --- SEARCH PARTIES ---
// No changes needed here based on the schema, the previous version is compatible.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location');
    const maxPrice = searchParams.get('maxPrice');
    const status = searchParams.get('status'); // Can be 'open', 'full', 'closed'
    const isGlobal = searchParams.get('isGlobal') === 'true';
    const latitude = searchParams.get('latitude');
    const longitude = searchParams.get('longitude');
    const rawMaxDistance = searchParams.get('maxDistance');
    const defaultMaxDistanceKm = 50;

    // --- Database Connection ---
    await connectToDatabase();

    // --- Build Query ---
    const query: any = {};

    // Filter by global/local
    query.isGlobal = isGlobal;

    // Geospatial query for local parties
    if (!isGlobal && latitude && longitude) {
        const parsedLatitude = parseFloat(latitude);
        const parsedLongitude = parseFloat(longitude);
        // Use provided maxDistance or default, ensuring it's a valid number
        const maxDistanceKm = rawMaxDistance ? parseInt(rawMaxDistance, 10) : defaultMaxDistanceKm;

        if (!isNaN(parsedLatitude) && !isNaN(parsedLongitude) && !isNaN(maxDistanceKm) && maxDistanceKm >= 0) {
            query.coordinates = {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parsedLongitude, parsedLatitude], // [longitude, latitude]
                    },
                    $maxDistance: maxDistanceKm * 1000, // Convert km to meters
                },
            };
        } else {
            console.warn('Invalid geo parameters for local search. Skipping $near query.', { latitude, longitude, rawMaxDistance });
            // Potential enhancement: If geo params invalid, maybe return no results for local?
            // query._id = null; // Force no results if strict handling is needed
        }
    } else if (!isGlobal && (!latitude || !longitude)) {
        console.warn('Local party search requested without latitude/longitude. Searching all local parties.');
    }

    // Other filters
    if (location) {
      query.location = { $regex: location, $options: 'i' }; // Case-insensitive regex search
    }
    if (maxPrice) {
      const parsedMaxPrice = parseFloat(maxPrice);
       if (!isNaN(parsedMaxPrice) && parsedMaxPrice >= 0) {
           query.estimatedPrice = { $lte: parsedMaxPrice }; // Less than or equal to
       } else {
            console.warn('Invalid maxPrice provided. Ignoring price filter.', { maxPrice });
       }
    }
    // Filter by status, checking against the allowed enum values from schema
    if (status && ['open', 'full', 'closed'].includes(status)) {
      query.status = status;
    } else if (status) {
       console.warn('Invalid status provided. Ignoring status filter.', { status });
    }

    // --- Find Parties ---
    console.log('Executing party search with query:', JSON.stringify(query));
    const parties = await Party.find(query)
      .populate('owner', 'username profilePhoto') // Populate owner details
      .populate('participants', 'username profilePhoto') // Populate participant details
      .sort({ createdAt: -1 }) // Sort by newest first
      .lean(); // Use lean() for performance

    // --- Success Response ---
    return NextResponse.json({
      parties,
      filters: { // Echo back the filters used (or parsed values)
        isGlobal,
        maxDistance: isGlobal || !query.coordinates ? null : (query.coordinates.$near.$maxDistance / 1000),
        latitude: isGlobal ? null : (latitude ? parseFloat(latitude) : null),
        longitude: isGlobal ? null : (longitude ? parseFloat(longitude) : null),
        location: location || null,
        maxPrice: maxPrice ? parseFloat(maxPrice) : null,
        status: status && ['open', 'full', 'closed'].includes(status) ? status : null, // Echo valid status used
      }
    });
  } catch (error) {
    // --- Error Handling ---
    console.error('Search parties error:', error);
    return NextResponse.json(
      { error: 'Internal server error while searching parties' },
      { status: 500 }
    );
  }
}