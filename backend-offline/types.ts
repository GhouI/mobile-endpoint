export interface CreatePartyRequest {
  name: string;
  description: string;
  destinationId: string;
  maxParticipants: number;
  startDate: string;
  endDate: string;
}

export interface PartyResponse {
  id: string;
  name: string;
  description: string;
  destinationId: string;
  maxParticipants: number;
  currentParticipants: number;
  startDate: string;
  endDate: string;
  status: 'open' | 'full' | 'closed';
  owner: {
    id: string;
    username: string;
    profilePhoto?: string;
  };
  participants: Array<{
    id: string;
    username: string;
    profilePhoto?: string;
  }>;
}

export interface GetDestinationResponse {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  country: string;
  city: string;
}

export interface ListDestinationsResponse {
  destinations: GetDestinationResponse[];
}

export interface SearchPartyFilter {
  destinationId?: string;
  startDate?: string;
  endDate?: string;
  status?: 'open' | 'full' | 'closed';
}

export interface SearchPartyResponse {
  parties: PartyResponse[];
}

export interface MyPartiesResponse {
  parties: PartyResponse[];
}

export interface LeavePartyResponse {
  message: string;
  party: PartyResponse;
}

export interface sendMessageResponses {
  message: string;
  history: Array<{
    id: string;
    user: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface AuthCred {
  username: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: {
    id: string;
    username: string;
  };
}

export interface ConversationHistory {
  id: string;
  user: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  updatedAt: string;
}
