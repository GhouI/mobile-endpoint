import {AuthCred, AuthResponse, ConversationHistory, 
    CreatePartyRequest, GetDestinationResponse, LeavePartyResponse, 
    ListDestinationsResponse, MyPartiesResponse, PartyResponse, 
    SearchPartyFilter, SearchPartyResponse, sendMessageResponses} from "./types";


import { Message } from "react-hook-form";
interface CustomHeaders {
    'Content-Type': string;
    'Authorization'?: string;
    [key: string]: string | undefined;
}
class MobileEndPointSDK {
    baseUrl: string = 'https://mobile-endpoint.vercel.app'
    token: string | null = null;

    constructor() {
        this.baseUrl = this.baseUrl;
    }
    //The Auth Token for logging
    setToken(token: string) {
        this.token = token;
    }
    getToken() {
        return this.token;
    }
    clearToken() {
        this.token = null;
    }

    private async request<T>(endpoint: string, method: string = 'GET', data?: any){
        const URL = `${this.baseUrl}${endpoint}`;
        const headers : CustomHeaders = {
            'Content-Type': 'application/json',
        }
        
        //if we have the token we can access the api properly.
        if(this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        //What we are sending
        const options : RequestInit = {
            method,
            headers: headers as Record<string, string>,
            body: data ? JSON.stringify(data) : undefined,
        }

        const response = await fetch(URL, options);

        //if an error happens
        if(!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'An error occurred');
        }
        return response.json();
    }


    //Auth Methods

    async signup(creditials: AuthCred) : Promise<AuthResponse> {
        return this.request('/api/auth/signup', 'POST', creditials);
    }

    async login(creds: AuthCred) : Promise<AuthResponse> {
        return this.request('/api/auth/signin', 'POST', creds);
    }

    //Party Methods
    async createParty(party: CreatePartyRequest) : Promise<PartyResponse> {
        return this.request('/api/parties', 'POST', party);
    }
    async searchParty(filters: SearchPartyFilter = {}) : Promise<SearchPartyResponse> {
        const qParams = new URLSearchParams();
        
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined) {
                qParams.append(key, value.toString());
            }
        }
        );
        const queryString = qParams.toString();
        const url = `/api/parties${queryString ? `?${queryString}` : ''}`;
        return this.request<SearchPartyResponse>(url, 'GET');
    }

    //Get Party Details

    async getPartyDetails(partyId: string) : Promise<PartyResponse> {
        return this.request(`/api/parties/${partyId}`, 'GET');
    }

    //Delete Party
    async deleteParty(partyId: string) : Promise<Omit<PartyResponse, 'party'>> {
        return this.request(`/api/parties/${partyId}`, 'DELETE');
    }

    //Join Party
    async joinParty(partyId: string) : Promise<PartyResponse> {
        return this.request(`/api/parties/${partyId}/join`, 'POST');
    }

    //Leave Party
    async leaveParty(partyId: string) : Promise<LeavePartyResponse> {
        return this.request(`/api/parties/${partyId}/join`, 'DELETE');
    }
    //Get the Users Parties
    async getUserParties() : Promise<MyPartiesResponse> {
        return this.request('/api/parties/user', 'GET');
    }

    //AI Converstation
    async getConversation(partyId: string) : Promise<ConversationHistory> {
        return this.request<ConversationHistory>(`/api/advisor?partyId=${partyId}`);
    }
    async sendMessageToAI(data: Message) : Promise<sendMessageResponses>{
        return this.request<sendMessageResponses>('/api/advisor', 'POST', data);
    }
    //Destinations

    async getDestinations(location?: string) : Promise<ListDestinationsResponse> {
        const locationParms = location ? `?query=${encodeURIComponent(location)}` : '';
        return this.request<ListDestinationsResponse>(`/api/destinations${locationParms}`);
    }

    async getLocation(id: string) : Promise<GetDestinationResponse> {
        return this.request<GetDestinationResponse>(`/api/destinations?id=${id}`); 
    }








}