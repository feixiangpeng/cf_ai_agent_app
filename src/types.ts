export interface Env {
  AI: Ai;
  CONVERSATION_STATE: DurableObjectNamespace;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ConversationSession {
  id: string;
  messages: ConversationMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface AIAgentResponse {
  content: string;
  conversationId: string;
  messageId: string;
}