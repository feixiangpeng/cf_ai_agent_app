# cf_ai_agent_app

Simple AI chat app built on Cloudflare for the assignment.

## What it does

Chat with an AI (Llama 3.1) that remembers your conversation. Built using Cloudflare's edge platform.

## Tech used

- **Cloudflare Workers** - runs the backend
- **Workers AI** - Llama 3.1 8B model
- **Durable Objects** - stores chat history
- **Workflows** - handles multi-step AI processing (sort of, simplified it)
- **Vanilla JS + Tailwind** - frontend

## Running it

Need Node 20+ and a Cloudflare account (free tier is fine).

```bash
npm install
npx wrangler login
npm run dev
```

Then open the localhost URL shown in your terminal (typically http://localhost:8787)

## Deploy

```bash
npm run deploy
```

## How it works

1. You send a message
2. Worker stores it in Durable Object
3. Calls Llama AI with conversation history
4. Stores response
5. Sends back to you

Pretty straightforward.

## Project structure

```
src/
├── index.ts           - main worker, routes
├── agent.ts           - AI calls
├── durableObject.ts   - conversation storage
├── workflow.ts        - workflow stuff (has analysis features)
└── types.ts           - typescript types

wrangler.toml          - config
```

## Notes

- Free tier has limits but should be fine for testing
- Conversations are stored per edge location
- No auth, just random conversation IDs
- Frontend is basic but functional

Assignment requirements:
- LLM: Llama 3.1 via Workers AI
- Workflow: Workers + Workflows
- Input: Chat interface
- Memory: Durable Objects

Check PROMPTS.md for development process.
