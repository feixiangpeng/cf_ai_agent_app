import { Workflow, WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { AIAgent } from './agent';
import { Env, ConversationMessage } from './types';

export interface ConversationWorkflowParams {
  conversationId: string;
  userMessage: string;
  history: ConversationMessage[];
}

export class ConversationWorkflow extends WorkflowEntrypoint<Env, ConversationWorkflowParams> {
  async run(event: WorkflowEvent<ConversationWorkflowParams>, step: WorkflowStep) {
    const { conversationId, userMessage, history } = event.payload;

    const userMsg: ConversationMessage = await step.do('create-user-message', async () => {
      return {
        id: crypto.randomUUID(),
        role: 'user' as const,
        content: userMessage,
        timestamp: Date.now()
      };
    });

    const conversationState = await step.do('store-user-message', async () => {
      const id = this.env.CONVERSATION_STATE.idFromName(conversationId);
      const stub = this.env.CONVERSATION_STATE.get(id);

      const response = await stub.fetch(`http://internal/conversation?id=${conversationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      });

      return await response.json();
    });

    const aiResponse = await step.do('process-ai-response', async () => {
      const agent = new AIAgent(this.env);
      return await agent.processMessage(userMessage, conversationId, history);
    });

    const assistantMsg: ConversationMessage = await step.do('create-assistant-message', async () => {
      return {
        id: aiResponse.messageId,
        role: 'assistant' as const,
        content: aiResponse.content,
        timestamp: Date.now()
      };
    });

    const finalState = await step.do('store-assistant-message', async () => {
      const id = this.env.CONVERSATION_STATE.idFromName(conversationId);
      const stub = this.env.CONVERSATION_STATE.get(id);

      const response = await stub.fetch(`http://internal/conversation?id=${conversationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: assistantMsg })
      });

      return await response.json();
    });

    await step.sleep('response-delay', '100ms');

    return {
      success: true,
      conversationId,
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      conversationState: finalState
    };
  }
}

export interface AnalysisWorkflowParams {
  conversationId: string;
  analysisType: 'sentiment' | 'summary' | 'topics';
}

export class ConversationAnalysisWorkflow extends WorkflowEntrypoint<Env, AnalysisWorkflowParams> {
  async run(event: WorkflowEvent<AnalysisWorkflowParams>, step: WorkflowStep) {
    const { conversationId, analysisType } = event.payload;

    const conversation = await step.do('fetch-conversation', async () => {
      const id = this.env.CONVERSATION_STATE.idFromName(conversationId);
      const stub = this.env.CONVERSATION_STATE.get(id);

      const response = await stub.fetch(`http://internal/conversation?id=${conversationId}`);
      return await response.json();
    });

    const analysis = await step.do('perform-analysis', async () => {
      const agent = new AIAgent(this.env);
      const messages = conversation.messages || [];

      let prompt = '';
      switch (analysisType) {
        case 'sentiment':
          prompt = 'Analyze the sentiment of this conversation. Provide a brief summary of the overall tone and emotional context.';
          break;
        case 'summary':
          prompt = 'Provide a concise summary of the key points discussed in this conversation.';
          break;
        case 'topics':
          prompt = 'Identify the main topics and themes discussed in this conversation. List them as bullet points.';
          break;
      }

      const conversationText = messages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: conversationText }
        ],
        max_tokens: 500,
        temperature: 0.3
      });

      return {
        type: analysisType,
        result: response.response || 'Analysis could not be completed.',
        timestamp: Date.now()
      };
    });

    await step.sleep('analysis-delay', '200ms');

    return {
      success: true,
      conversationId,
      analysis
    };
  }
}