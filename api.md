# API Documentation

This document outlines all available API endpoints in the application.

## Authentication

### Sign Up
- **Endpoint**: `POST /api/auth/signup`
- **Description**: Register a new user
- **Request Body**:
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
- **Example Request**:
  ```bash
  curl -X POST http://localhost:3000/api/auth/signup \
    -H "Content-Type: application/json" \
    -d '{
      "username": "johndoe",
      "password": "securepass123"
    }'
  ```
- **Example Response**:
  ```json
  {
    "message": "User created successfully",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "username": "johndoe"
    }
  }
  ```
- **Error Responses**:
  - `400`: Username and password are required
  - `400`: Username already exists
  - `500`: Internal server error

### Sign In
- **Endpoint**: `POST /api/auth/signin`
- **Description**: Authenticate existing user
- **Request Body**:
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
- **Example Request**:
  ```bash
  curl -X POST http://localhost:3000/api/auth/signin \
    -H "Content-Type: application/json" \
    -d '{
      "username": "johndoe",
      "password": "securepass123"
    }'
  ```
- **Example Response**:
  ```json
  {
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "username": "johndoe"
    }
  }
  ```
- **Error Responses**:
  - `400`: Username and password are required
  - `401`: Invalid username or password
  - `500`: Internal server error

## Parties

### Create Party
- **Endpoint**: `POST /api/parties`
- **Authentication**: Required
- **Description**: Create a new party. Parties can be either global (online) or local (physical location).
- **Request Body**:
  ```json
  {
    "location": "string",
    "description": "string",
    "estimatedPrice": "number",
    "maxParticipants": "number",
    "imageUrl": "string (optional)",
    "additionalFields": "object (optional)",
    "isGlobal": "boolean",
    "latitude": "number (required if !isGlobal)",
    "longitude": "number (required if !isGlobal)"
  }
  ```
- **Field Requirements**:
  - `location`: Required. The name or description of the party location
  - `description`: Required. Detailed description of the party
  - `estimatedPrice`: Required. Must be a non-negative number
  - `maxParticipants`: Required. Must be a number greater than or equal to 1
  - `isGlobal`: Required. Boolean indicating if the party is global (true) or local (false)
  - `latitude` and `longitude`: Required only for local parties (isGlobal: false)
  - `imageUrl`: Optional. URL of the party image
  - `additionalFields`: Optional. Object containing any additional party information

- **Example Requests**:
  ```bash
  # Create a global party
  curl -X POST http://localhost:3000/api/parties \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
    -H "Content-Type: application/json" \
    -d '{
      "location": "Online Gaming Party",
      "description": "Join for an awesome gaming session!",
      "estimatedPrice": 0,
      "maxParticipants": 5,
      "isGlobal": true
    }'

  # Create a local party
  curl -X POST http://localhost:3000/api/parties \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
    -H "Content-Type: application/json" \
    -d '{
      "location": "Central Park",
      "description": "Outdoor gaming meetup",
      "estimatedPrice": 10,
      "maxParticipants": 4,
      "isGlobal": false,
      "latitude": 40.7829,
      "longitude": -73.9654,
      "imageUrl": "https://example.com/central-park.jpg",
      "additionalFields": {
        "meetingPoint": "Near the fountain",
        "activities": ["Board games", "Frisbee"]
      }
    }'
  ```
- **Example Responses**:
  ```json
  // Global Party Response
  {
    "message": "Party created successfully",
    "party": {
      "id": "507f1f77bcf86cd799439012",
      "location": "Online Gaming Party",
      "description": "Join for an awesome gaming session!",
      "estimatedPrice": 0,
      "maxParticipants": 5,
      "currentParticipants": 1,
      "isGlobal": true,
      "coordinates": null,
      "owner": {
        "id": "507f1f77bcf86cd799439011",
        "username": "johndoe",
        "profilePhoto": "/default-profile.png"
      },
      "participants": [
        {
          "id": "507f1f77bcf86cd799439011",
          "username": "johndoe",
          "profilePhoto": "/default-profile.png"
        }
      ],
      "status": "open",
      "createdAt": "2024-03-20T12:00:00.000Z",
      "updatedAt": "2024-03-20T12:00:00.000Z"
    }
  }

  // Local Party Response
  {
    "message": "Party created successfully",
    "party": {
      "id": "507f1f77bcf86cd799439013",
      "location": "Central Park",
      "description": "Outdoor gaming meetup",
      "estimatedPrice": 10,
      "maxParticipants": 4,
      "currentParticipants": 1,
      "isGlobal": false,
      "coordinates": {
        "type": "Point",
        "coordinates": [-73.9654, 40.7829]
      },
      "imageUrl": "https://example.com/central-park.jpg",
      "additionalFields": {
        "meetingPoint": "Near the fountain",
        "activities": ["Board games", "Frisbee"]
      },
      "owner": {
        "id": "507f1f77bcf86cd799439011",
        "username": "johndoe",
        "profilePhoto": "/default-profile.png"
      },
      "participants": [
        {
          "id": "507f1f77bcf86cd799439011",
          "username": "johndoe",
          "profilePhoto": "/default-profile.png"
        }
      ],
      "status": "open",
      "createdAt": "2024-03-20T12:00:00.000Z",
      "updatedAt": "2024-03-20T12:00:00.000Z"
    }
  }
  ```
- **Error Responses**:
  - `400`: Missing required fields
  - `400`: Invalid numeric fields (price negative or maxParticipants < 1)
  - `400`: Missing coordinates for local party
  - `400`: Invalid coordinates format
  - `401`: Authentication required
  - `401`: Invalid token
  - `500`: Internal server error

### Search Parties
- **Endpoint**: `GET /api/parties`
- **Description**: Search for parties
- **Example Request**:
  ```bash
  # Global search
  curl "http://localhost:3000/api/parties?isGlobal=true&maxPrice=2000"

  # Local search
  curl "http://localhost:3000/api/parties?isGlobal=false&latitude=48.8566&longitude=2.3522&maxDistance=100&location=Paris"
  ```
- **Example Response**:
  ```json
  {
    "parties": [
      {
        "id": "507f1f77bcf86cd799439012",
        "location": "Paris, France",
        "description": "Looking for travel buddies to explore Paris!",
        "estimatedPrice": 1500,
        "maxParticipants": 4,
        "currentParticipants": 1,
        "imageUrl": "https://example.com/paris.jpg",
        "owner": {
          "id": "507f1f77bcf86cd799439011",
          "username": "johndoe",
          "profilePhoto": "/default-profile.png"
        },
        "participants": [
          {
            "id": "507f1f77bcf86cd799439011",
            "username": "johndoe",
            "profilePhoto": "/default-profile.png"
          }
        ],
        "status": "open"
      }
    ],
    "filters": {
      "isGlobal": false,
      "maxDistance": 100,
      "location": "Paris",
      "maxPrice": null,
      "status": null
    }
  }
  ```
- **Error Responses**:
  - `500`: Internal server error

### Get Party Details
- **Endpoint**: `GET /api/parties/{id}`
- **Example Request**:
  ```bash
  curl http://localhost:3000/api/parties/507f1f77bcf86cd799439012
  ```
- **Example Response**:
  ```json
  {
    "party": {
      "id": "507f1f77bcf86cd799439012",
      "location": "Paris, France",
      "description": "Looking for travel buddies to explore Paris!",
      "estimatedPrice": 1500,
      "maxParticipants": 4,
      "currentParticipants": 1,
      "imageUrl": "https://example.com/paris.jpg",
      "isGlobal": false,
      "coordinates": {
        "type": "Point",
        "coordinates": [2.3522, 48.8566]
      },
      "additionalFields": {
        "duration": "7 days",
        "preferredLanguages": ["English", "French"]
      },
      "owner": {
        "id": "507f1f77bcf86cd799439011",
        "username": "johndoe",
        "profilePhoto": "/default-profile.png"
      },
      "participants": [
        {
          "id": "507f1f77bcf86cd799439011",
          "username": "johndoe",
          "profilePhoto": "/default-profile.png"
        }
      ],
      "status": "open",
      "createdAt": "2024-03-20T12:00:00.000Z",
      "updatedAt": "2024-03-20T12:00:00.000Z"
    }
  }
  ```

### Update Party
- **Example Request**:
  ```bash
  curl -X PATCH http://localhost:3000/api/parties/507f1f77bcf86cd799439012 \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
    -H "Content-Type: application/json" \
    -d '{
      "description": "Updated description: Looking for 3 travel buddies to explore Paris!",
      "maxParticipants": 4,
      "estimatedPrice": 1800
    }'
  ```
- **Example Response**:
  ```json
  {
    "message": "Party updated successfully",
    "party": {
      "id": "507f1f77bcf86cd799439012",
      "description": "Updated description: Looking for 3 travel buddies to explore Paris!",
      "estimatedPrice": 1800,
      "maxParticipants": 4,
      // ... other party fields
    }
  }
  ```

### Delete Party
- **Endpoint**: `DELETE /api/parties/{id}`
- **Authentication**: Required (Party owner only)
- **Description**: Delete a party
- **Response**:
  ```json
  {
    "message": "Party deleted successfully"
  }
  ```
- **Error Responses**:
  - `401`: Authentication required
  - `403`: Only the party owner can delete the party
  - `404`: Party not found
  - `500`: Internal server error

### Join Party
- **Example Request**:
  ```bash
  curl -X POST http://localhost:3000/api/parties/507f1f77bcf86cd799439012/join \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  ```
- **Example Response**:
  ```json
  {
    "message": "Successfully joined the party",
    "party": {
      "id": "507f1f77bcf86cd799439012",
      "currentParticipants": 2,
      "participants": [
        {
          "id": "507f1f77bcf86cd799439011",
          "username": "johndoe",
          "profilePhoto": "/default-profile.png"
        },
        {
          "id": "507f1f77bcf86cd799439013",
          "username": "janesmith",
          "profilePhoto": "/default-profile.png"
        }
      ],
      // ... other party fields
    }
  }
  ```

### Leave Party
- **Example Request**:
  ```bash
  curl -X DELETE http://localhost:3000/api/parties/507f1f77bcf86cd799439012/join \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  ```
- **Example Response**:
  ```json
  {
    "message": "Successfully left the party",
    "party": {
      "id": "507f1f77bcf86cd799439012",
      "currentParticipants": 1,
      "participants": [
        {
          "id": "507f1f77bcf86cd799439011",
          "username": "johndoe",
          "profilePhoto": "/default-profile.png"
        }
      ],
      // ... other party fields
    }
  }
  ```

### Get My Parties
- **Example Request**:
  ```bash
  # Get all parties
  curl http://localhost:3000/api/parties/my \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

  # Get only created parties
  curl "http://localhost:3000/api/parties/my?type=created" \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  ```
- **Example Response**:
  ```json
  {
    "created": [
      {
        "id": "507f1f77bcf86cd799439012",
        "location": "Paris, France",
        // ... other party fields
      }
    ],
    "joined": [
      {
        "id": "507f1f77bcf86cd799439014",
        "location": "Tokyo, Japan",
        // ... other party fields
      }
    ],
    "total": 2
  }
  ```

## Travel Advisor

### Get Conversation History
- **Example Request**:
  ```bash
  curl "http://localhost:3000/api/advisor?partyId=507f1f77bcf86cd799439012" \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  ```
- **Example Response**:
  ```json
  {
    "messages": [
      {
        "id": "507f1f77bcf86cd799439020",
        "role": "user",
        "content": "What are the best places to visit in Paris?",
        "user": {
          "id": "507f1f77bcf86cd799439011",
          "username": "johndoe",
          "profilePhoto": "/default-profile.png"
        },
        "createdAt": "2024-03-20T12:00:00.000Z"
      },
      {
        "id": "507f1f77bcf86cd799439021",
        "role": "assistant",
        "content": "Paris offers many iconic attractions! Here are some must-visit places:\n1. Eiffel Tower\n2. Louvre Museum\n3. Notre-Dame Cathedral...",
        "createdAt": "2024-03-20T12:00:01.000Z"
      }
    ],
    "total": 2
  }
  ```

### Send Message to Advisor
- **Example Request**:
  ```bash
  curl -X POST http://localhost:3000/api/advisor \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
    -H "Content-Type: application/json" \
    -d '{
      "message": "What are the best places to visit in Paris?",
      "partyId": "507f1f77bcf86cd799439012"
    }'
  ```
- **Example Response**:
  ```json
  {
    "message": "Paris offers many iconic attractions! Here are some must-visit places:\n1. Eiffel Tower\n2. Louvre Museum\n3. Notre-Dame Cathedral...",
    "usage": {
      "prompt_tokens": 50,
      "completion_tokens": 150,
      "total_tokens": 200
    },
    "history": [
      {
        "id": "507f1f77bcf86cd799439020",
        "role": "user",
        "content": "What are the best places to visit in Paris?",
        "user": {
          "id": "507f1f77bcf86cd799439011",
          "username": "johndoe",
          "profilePhoto": "/default-profile.png"
        },
        "createdAt": "2024-03-20T12:00:00.000Z"
      },
      {
        "id": "507f1f77bcf86cd799439021",
        "role": "assistant",
        "content": "Paris offers many iconic attractions! Here are some must-visit places:\n1. Eiffel Tower\n2. Louvre Museum\n3. Notre-Dame Cathedral...",
        "createdAt": "2024-03-20T12:00:01.000Z"
      }
    ]
  }
  ```

## Destinations

### Get Destinations
- **Endpoint**: `GET /api/destinations`
- **Description**: Get all destinations or search by query
- **Query Parameters**:
  - `query`: Search term (optional)
  - `id`: Destination ID to get full details (optional)
- **Example Request**:
  ```bash
  # Get all destinations
  curl http://localhost:3000/api/destinations

  # Search destinations
  curl http://localhost:3000/api/destinations?query=paris

  # Get single destination
  curl http://localhost:3000/api/destinations?id=507f1f77bcf86cd799439013
  ```
- **Example Response**:
  ```json
  {
    "destinations": [
      {
        "id": "507f1f77bcf86cd799439013",
        "name": "Paris",
        "shortDescription": "The City of Light",
        "bannerUrl": "https://example.com/paris-banner.jpg",
        "weather": {
          "average": "15°C",
          "description": "Mild"
        },
        "currency": {
          "code": "EUR",
          "name": "Euro",
          "symbol": "€"
        },
        "languages": [
          {
            "name": "French",
            "code": "fr"
          }
        ],
        "attractions": [
          {
            "name": "Eiffel Tower",
            "description": "Iconic iron tower",
            "iconUrl": "https://example.com/eiffel-icon.jpg"
          }
        ]
      }
    ],
    "total": 1
  }
  ```
- **Error Responses**:
  - `404`: Destination not found (when using id parameter)
  - `500`: Internal server error

### Create Destination
- **Endpoint**: `POST /api/destinations`
- **Description**: Create a new destination
- **Request Body**:
  ```json
  {
    "name": "string",
    "shortDescription": "string",
    "longDescription": "string",
    "bannerUrl": "string",
    "weather": {
      "average": "string",
      "description": "string"
    },
    "currency": {
      "code": "string",
      "name": "string",
      "symbol": "string"
    },
    "languages": [
      {
        "name": "string",
        "code": "string"
      }
    ],
    "attractions": [
      {
        "name": "string",
        "description": "string",
        "iconUrl": "string"
      }
    ]
  }
  ```
- **Example Request**:
  ```bash
  curl -X POST http://localhost:3000/api/destinations \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Tokyo",
      "shortDescription": "Vibrant metropolis of Japan",
      "longDescription": "Tokyo is the capital and largest city of Japan...",
      "bannerUrl": "https://example.com/tokyo-banner.jpg",
      "weather": {
        "average": "16°C",
        "description": "Mild"
      },
      "currency": {
        "code": "JPY",
        "name": "Japanese Yen",
        "symbol": "¥"
      },
      "languages": [
        {
          "name": "Japanese",
          "code": "ja"
        }
      ],
      "attractions": [
        {
          "name": "Shibuya Crossing",
          "description": "World's busiest pedestrian crossing",
          "iconUrl": "https://example.com/shibuya-icon.jpg"
        }
      ]
    }'
  ```
- **Example Response**:
  ```json
  {
    "destination": {
      "id": "507f1f77bcf86cd799439014",
      "name": "Tokyo",
      "shortDescription": "Vibrant metropolis of Japan",
      "longDescription": "Tokyo is the capital and largest city of Japan...",
      "bannerUrl": "https://example.com/tokyo-banner.jpg",
      "weather": {
        "average": "16°C",
        "description": "Mild"
      },
      "currency": {
        "code": "JPY",
        "name": "Japanese Yen",
        "symbol": "¥"
      },
      "languages": [
        {
          "name": "Japanese",
          "code": "ja"
        }
      ],
      "attractions": [
        {
          "name": "Shibuya Crossing",
          "description": "World's busiest pedestrian crossing",
          "iconUrl": "https://example.com/shibuya-icon.jpg"
        }
      ],
      "createdAt": "2024-04-15T12:00:00.000Z",
      "updatedAt": "2024-04-15T12:00:00.000Z"
    }
  }
  ```
- **Error Responses**:
  - `400`: Missing required fields
  - `409`: A destination with this name already exists
  - `500`: Internal server error

## Authentication Notes

All authenticated endpoints require a Bearer token in the Authorization header:
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." http://localhost:3000/api/endpoint
```

The JWT token is valid for 7 days from issuance. 