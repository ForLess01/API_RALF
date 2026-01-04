export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIService {
  name: string;
  chat: (messages: ChatMessage[]) => Promise<AsyncIterable<string>>;
}