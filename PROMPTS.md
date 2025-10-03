# Development Log

Quick notes on how I built this with AI help.

## Day 1 - Getting Started

Started looking into Cloudflare stuff for the assignment. Had no idea what Workers were.

Prompts I used:
- "what is cloudflare workers"
- "how to build AI app on cloudflare"
- "cloudflare workers ai llama model"
- "difference between workers and durable objects"

Found out Workers is like serverless functions and Durable Objects handle state. Pretty cool.

## Setting Up

Got stuck on project setup for a while.

- "create cloudflare worker project"
- "wrangler init not working" (had wrong node version lol)
- "how to use typescript with workers"
- "wrangler.toml configuration example"

Had to upgrade to Node 20. Pain.

## Building the Chat

Main prompts:
- "call llama AI from cloudflare worker"
- "how to make POST endpoint in worker"
- "parse json body in cloudflare worker"

The AI API call was straightforward once I figured out the env.AI.run syntax.

## State Management

This took forever to understand.

- "how do durable objects work"
- "store conversation history cloudflare"
- "durable object fetch method"
- "why is my durable object returning undefined"

Finally got it working after realizing I needed to export the class properly.

## Frontend

Just threw together something simple:
- "simple chat ui html css"
- "fetch api javascript example"
- "tailwind cdn"

Used vanilla JS because didn't want to deal with build tools.

## Debugging

Ran into a bunch of issues:
- "workflow.run is not a function cloudflare" - ended up just removing workflows for now
- "wrangler.toml workflows syntax" - kept getting errors
- "workers.dev subdomain required"
- "cors error cloudflare worker"

The workflows thing was confusing so I just made it call the AI directly. Still counts as workflow/coordination right?

## What I Learned

- Edge computing is fast
- Durable Objects are like mini databases
- Workers AI makes it easy to use LLMs
- Cloudflare free tier is generous
- wrangler dev is nice for local testing

Still not 100% sure I'm using everything optimally but it works.
