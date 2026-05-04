export interface Message {
  id: string;
  sender: 'user' | 'nora';
  text: string;
  timestamp: string;
  options?: string[];
  imageUrls?: string[];
  audioUrl?: string;
}

export interface BotResponse {
  text: string;
  mediaUrls?: string[];
  options?: string[];
  flow?: string;
  step?: string;
  requestId?: string;
}

export interface SessionState {
  flow?: string;
  step?: string;
}
