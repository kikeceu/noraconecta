export interface Message {
  id: string;
  sender: 'user' | 'nora';
  text: string;
  timestamp: string;
  options?: string[];
}

export interface SimulatedPhone {
  phone: string;
  label: string;
  role: 'USER' | 'PROFESSIONAL';
}

export interface BotResponse {
  text: string;
  mediaUrls?: string[];
  options?: string[];
  flow?: string;
  step?: string;
}

export interface SessionState {
  flow?: string;
  step?: string;
}
