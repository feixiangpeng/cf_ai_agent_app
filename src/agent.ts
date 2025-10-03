import { Env, ConversationMessage, AIAgentResponse } from './types';

export class AIAgent {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async processMessage(
    message: string,
    conversationId: string,
    history: ConversationMessage[] = []
  ): Promise<AIAgentResponse> {
    try {
      const messages = [
        {
          role: 'system',
          content: 'You are a helpful AI assistant. Provide clear, concise, and accurate responses.'
        },
        ...history.slice(-10).map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        {
          role: 'user',
          content: message
        }
      ];

      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages,
        max_tokens: 1000,
        temperature: 0.7
      });

      const messageId = crypto.randomUUID();

      return {
        content: response.response || 'I apologize, but I could not generate a response.',
        conversationId,
        messageId
      };
    } catch (error) {
      console.error('AI processing error:', error);
      return {
        content: 'I encountered an error while processing your message. Please try again.',
        conversationId,
        messageId: crypto.randomUUID()
      };
    }
  }

  async generateTitle(messages: ConversationMessage[]): Promise<string> {
    if (messages.length === 0) return 'New Conversation';

    const firstMessage = messages.find(m => m.role === 'user')?.content || 'New Conversation';

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'Generate a short, descriptive title (max 5 words) for this conversation based on the first message.'
          },
          {
            role: 'user',
            content: firstMessage
          }
        ],
        max_tokens: 20,
        temperature: 0.3
      });

      return response.response?.trim() || firstMessage.slice(0, 50) + '...';
    } catch {
      return firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '');
    }
  }
}