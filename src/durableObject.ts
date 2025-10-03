import { ConversationMessage, ConversationSession } from './types';

export class ConversationState {
  private storage: DurableObjectStorage;
  private env: any;

  constructor(state: DurableObjectState, env: any) {
    this.storage = state.storage;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const conversationId = url.searchParams.get('id');

    if (!conversationId) {
      return new Response('Missing conversation ID', { status: 400 });
    }

    switch (request.method) {
      case 'GET':
        return this.getConversation(conversationId);
      case 'POST':
        return this.addMessage(conversationId, request);
      case 'PUT':
        return this.updateConversation(conversationId, request);
      case 'DELETE':
        return this.deleteConversation(conversationId);
      default:
        return new Response('Method not allowed', { status: 405 });
    }
  }

  private async getConversation(conversationId: string): Promise<Response> {
    try {
      const session = await this.storage.get<ConversationSession>(`conversation:${conversationId}`);

      if (!session) {
        const newSession: ConversationSession = {
          id: conversationId,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await this.storage.put(`conversation:${conversationId}`, newSession);
        return new Response(JSON.stringify(newSession), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(session), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error getting conversation:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }

  private async addMessage(conversationId: string, request: Request): Promise<Response> {
    try {
      const body = await request.json() as { message: ConversationMessage };
      const { message } = body;

      let session = await this.storage.get<ConversationSession>(`conversation:${conversationId}`);

      if (!session) {
        session = {
          id: conversationId,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      }

      session.messages.push({
        ...message,
        id: message.id || crypto.randomUUID(),
        timestamp: Date.now()
      });
      session.updatedAt = Date.now();

      await this.storage.put(`conversation:${conversationId}`, session);

      return new Response(JSON.stringify(session), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error adding message:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }

  private async updateConversation(conversationId: string, request: Request): Promise<Response> {
    try {
      const body = await request.json() as Partial<ConversationSession>;

      let session = await this.storage.get<ConversationSession>(`conversation:${conversationId}`);

      if (!session) {
        return new Response('Conversation not found', { status: 404 });
      }

      session = {
        ...session,
        ...body,
        id: conversationId,
        updatedAt: Date.now()
      };

      await this.storage.put(`conversation:${conversationId}`, session);

      return new Response(JSON.stringify(session), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error updating conversation:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }

  private async deleteConversation(conversationId: string): Promise<Response> {
    try {
      await this.storage.delete(`conversation:${conversationId}`);
      return new Response('Conversation deleted', { status: 200 });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }

  async listConversations(): Promise<ConversationSession[]> {
    try {
      const conversations: ConversationSession[] = [];
      const list = await this.storage.list({ prefix: 'conversation:' });

      for (const [, session] of list) {
        conversations.push(session as ConversationSession);
      }

      return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
      console.error('Error listing conversations:', error);
      return [];
    }
  }
}