import { Env, ConversationMessage } from './types';
import { AIAgent } from './agent';
import { ConversationState } from './durableObject';
import { ConversationWorkflow, ConversationAnalysisWorkflow } from './workflow';

export { ConversationState, ConversationWorkflow, ConversationAnalysisWorkflow };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (pathname === '/') {
        return new Response(await getIndexHTML(), {
          headers: {
            'Content-Type': 'text/html',
            ...corsHeaders
          }
        });
      }

      if (pathname === '/api/chat') {
        if (request.method !== 'POST') {
          return new Response('Method not allowed', {
            status: 405,
            headers: corsHeaders
          });
        }

        return await handleChatRequest(request, env);
      }

      if (pathname === '/api/conversations') {
        return await handleConversationsRequest(request, env);
      }

      if (pathname.startsWith('/api/conversation/')) {
        const conversationId = pathname.split('/')[3];
        return await handleConversationRequest(request, env, conversationId);
      }

      if (pathname === '/api/analyze') {
        if (request.method !== 'POST') {
          return new Response('Method not allowed', {
            status: 405,
            headers: corsHeaders
          });
        }

        return await handleAnalysisRequest(request, env);
      }

      return new Response('Not found', {
        status: 404,
        headers: corsHeaders
      });

    } catch (error) {
      console.error('Request handling error:', error);
      return new Response('Internal server error', {
        status: 500,
        headers: corsHeaders
      });
    }
  },
};

async function handleChatRequest(request: Request, env: Env): Promise<Response> {
  try {
    const { message, conversationId } = await request.json() as {
      message: string;
      conversationId: string;
    };

    if (!message || !conversationId) {
      return new Response('Missing message or conversationId', { status: 400 });
    }

    const id = env.CONVERSATION_STATE.idFromName(conversationId);
    const stub = env.CONVERSATION_STATE.get(id);

    const conversationResponse = await stub.fetch(
      `http://internal/conversation?id=${conversationId}`
    );
    const conversation = await conversationResponse.json();

    const agent = new AIAgent(env);
    const response = await agent.processMessage(
      message,
      conversationId,
      conversation.messages || []
    );

    const userMsg: ConversationMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: Date.now()
    };

    await stub.fetch(`http://internal/conversation?id=${conversationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMsg })
    });

    const assistantMsg: ConversationMessage = {
      id: response.messageId,
      role: 'assistant',
      content: response.content,
      timestamp: Date.now()
    };

    await stub.fetch(`http://internal/conversation?id=${conversationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: assistantMsg })
    });

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Chat request error:', error);
    return new Response(JSON.stringify({
      error: 'Chat service temporarily unavailable',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

async function handleConversationsRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    return new Response(JSON.stringify({ conversations: [] }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Conversations request error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

async function handleConversationRequest(
  request: Request,
  env: Env,
  conversationId: string
): Promise<Response> {
  try {
    const id = env.CONVERSATION_STATE.idFromName(conversationId);
    const stub = env.CONVERSATION_STATE.get(id);

    const response = await stub.fetch(
      `http://internal/conversation?id=${conversationId}`,
      { method: request.method, body: request.body }
    );

    const result = await response.text();

    return new Response(result, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      status: response.status
    });

  } catch (error) {
    console.error('Conversation request error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

async function handleAnalysisRequest(request: Request, env: Env): Promise<Response> {
  try {
    const { conversationId, analysisType } = await request.json() as {
      conversationId: string;
      analysisType: 'sentiment' | 'summary' | 'topics';
    };

    if (!conversationId || !analysisType) {
      return new Response('Missing conversationId or analysisType', { status: 400 });
    }

    const workflowId = `analysis_${conversationId}_${analysisType}_${Date.now()}`;
    const workflow = await env.CONVERSATION_ANALYSIS_WORKFLOW.create({
      id: workflowId,
      params: {
        conversationId,
        analysisType
      }
    });

    const result = await workflow.run();

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Analysis request error:', error);
    return new Response('Analysis service temporarily unavailable', {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
}

async function getIndexHTML(): Promise<string> {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Agent Chat</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .message-fade-in {
            animation: fadeIn 0.3s ease-in;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .typing-indicator {
            animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
    </style>
</head>
<body class="bg-gray-100 min-h-screen">
    <div id="app" class="max-w-4xl mx-auto bg-white min-h-screen shadow-lg">
        <div class="bg-blue-600 text-white p-4 shadow-md">
            <h1 class="text-2xl font-bold">AI Agent Assistant</h1>
            <p class="text-blue-100">Powered by Cloudflare Workers AI</p>
        </div>

        <div class="flex flex-col h-screen" style="height: calc(100vh - 80px);">
            <div id="messages" class="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                <div class="message-fade-in">
                    <div class="flex items-start space-x-3">
                        <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                            <span class="text-white text-sm font-bold">AI</span>
                        </div>
                        <div class="bg-white rounded-lg px-4 py-2 shadow-sm max-w-md">
                            <p class="text-gray-800">Hello! I'm your AI assistant powered by Cloudflare Workers. How can I help you today?</p>
                            <span class="text-xs text-gray-500 mt-1 block">Just now</span>
                        </div>
                    </div>
                </div>
            </div>

            <div id="typing-indicator" class="px-4 py-2 hidden">
                <div class="flex items-center space-x-2">
                    <div class="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <span class="text-white text-xs">AI</span>
                    </div>
                    <div class="bg-gray-200 rounded-lg px-3 py-2">
                        <div class="flex space-x-1">
                            <div class="w-2 h-2 bg-gray-400 rounded-full typing-indicator"></div>
                            <div class="w-2 h-2 bg-gray-400 rounded-full typing-indicator" style="animation-delay: 0.1s;"></div>
                            <div class="w-2 h-2 bg-gray-400 rounded-full typing-indicator" style="animation-delay: 0.2s;"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="border-t bg-white p-4">
                <form id="chat-form" class="flex space-x-2">
                    <input
                        type="text"
                        id="message-input"
                        placeholder="Type your message..."
                        class="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autocomplete="off"
                    >
                    <button
                        type="submit"
                        class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        id="send-button"
                    >
                        Send
                    </button>
                </form>
            </div>
        </div>
    </div>

    <script>
        class AIChat {
            constructor() {
                this.conversationId = this.generateConversationId();
                this.messagesContainer = document.getElementById('messages');
                this.messageInput = document.getElementById('message-input');
                this.chatForm = document.getElementById('chat-form');
                this.sendButton = document.getElementById('send-button');
                this.typingIndicator = document.getElementById('typing-indicator');

                this.init();
            }

            init() {
                this.chatForm.addEventListener('submit', (e) => this.handleSubmit(e));
                this.messageInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        this.handleSubmit(e);
                    }
                });
            }

            generateConversationId() {
                return 'conv_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
            }

            async handleSubmit(e) {
                e.preventDefault();

                const message = this.messageInput.value.trim();
                if (!message) return;

                this.addMessage(message, 'user');
                this.messageInput.value = '';
                this.setLoading(true);

                try {
                    const response = await fetch('/api/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            message,
                            conversationId: this.conversationId
                        })
                    });

                    if (!response.ok) {
                        throw new Error(\`HTTP error! status: \${response.status}\`);
                    }

                    const data = await response.json();
                    this.addMessage(data.content, 'assistant');
                } catch (error) {
                    console.error('Error:', error);
                    this.addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
                } finally {
                    this.setLoading(false);
                }
            }

            addMessage(content, role) {
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message-fade-in';

                const isUser = role === 'user';
                const avatarBg = isUser ? 'bg-green-500' : 'bg-blue-500';
                const messageAlign = isUser ? 'flex-row-reverse' : 'flex-row';
                const messageBg = isUser ? 'bg-green-100' : 'bg-white';

                messageDiv.innerHTML = \`
                    <div class="flex items-start space-x-3 \${messageAlign}">
                        <div class="w-8 h-8 \${avatarBg} rounded-full flex items-center justify-center flex-shrink-0">
                            <span class="text-white text-xs font-bold">\${isUser ? 'U' : 'AI'}</span>
                        </div>
                        <div class="\${messageBg} rounded-lg px-4 py-2 shadow-sm max-w-md \${isUser ? 'ml-3' : 'mr-3'}">
                            <p class="text-gray-800 whitespace-pre-wrap">\${this.escapeHtml(content)}</p>
                            <span class="text-xs text-gray-500 mt-1 block">\${this.formatTimestamp(Date.now())}</span>
                        </div>
                    </div>
                \`;

                this.messagesContainer.appendChild(messageDiv);
                this.scrollToBottom();
            }

            setLoading(loading) {
                if (loading) {
                    this.typingIndicator.classList.remove('hidden');
                    this.sendButton.disabled = true;
                    this.messageInput.disabled = true;
                } else {
                    this.typingIndicator.classList.add('hidden');
                    this.sendButton.disabled = false;
                    this.messageInput.disabled = false;
                    this.messageInput.focus();
                }
                this.scrollToBottom();
            }

            scrollToBottom() {
                setTimeout(() => {
                    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
                }, 100);
            }

            escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }

            formatTimestamp(timestamp) {
                const date = new Date(timestamp);
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            new AIChat();
        });
    </script>
</body>
</html>`;

  return html;
}