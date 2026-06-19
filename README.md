# chatgpt-local-agent-bridge

Experimental local-first bridge for coordinating safe local tasks from a normal ChatGPT conversation.

The bridge runs on your own PC and exposes a small set of controlled HTTP tools. ChatGPT stays the interface and orchestrator. Local work is constrained by authentication, a workspace sandbox, and an explicit command allowlist. It can optionally connect to LM Studio or another local OpenAI-compatible runtime without paid API calls.

This is an MVP for local experimentation, not a hosted service.

## Features

- Auth on by default.
- Loopback-only no-auth mode for local development, disabled by default.
- LM Studio health, model listing, and ask endpoints.
- Sandbox-limited file listing, file reading, and note writing.
- Strict command allowlist for running known scripts.
- In-memory task submission and task status endpoints.
- Output length limits and basic secret redaction.

## Quick Start

```powershell
npm install
Copy-Item -LiteralPath .env.example -Destination .env
npm run build
npm run smoke
npm start
```

Set `BRIDGE_AUTH_TOKEN` in your environment or `.env` before using the bridge. Do not reuse important passwords or API keys as bridge tokens.

## Endpoints

All endpoints except `/status` require auth by default:

- `GET /status`
- `GET /lmstudio_health`
- `GET /lmstudio_models`
- `POST /lmstudio_ask`
- `GET /list_workspace`
- `GET /read_file?path=notes/example.txt`
- `POST /write_note`
- `POST /run_allowed_script`
- `POST /submit_task`
- `GET /task_status?id=<task-id>`

Use `Authorization: Bearer <BRIDGE_AUTH_TOKEN>`.

## Safety Boundaries

The bridge intentionally does not provide:

- arbitrary shell execution
- delete-file tools
- full disk access
- credential or cookie access
- browser profile access
- admin or system actions
- public internet exposure guarantees

Never expose this bridge directly to the public internet. If you tunnel it for testing, put strong authentication and access controls in front of it.

## License

MIT
