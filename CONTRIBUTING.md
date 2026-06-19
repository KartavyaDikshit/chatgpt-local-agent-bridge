# Contributing

Thanks for helping improve `chatgpt-local-agent-bridge`.

This project is security-first. It is designed to let a ChatGPT conversation coordinate safe local tasks on a user's own PC without exposing the whole machine.

## Setup

```powershell
npm install
npm run build
npm run smoke
```

The smoke test uses a local mock runtime and a temporary sandbox. It should not require secrets or paid API calls.

## Contribution Rules

- Do not commit `.env`, `.env.*`, logs, job outputs, credentials, browser profiles, or local runtime state.
- Do not add private endpoints, private IPs, usernames, emails, tokens, API keys, cookies, or machine-specific paths.
- Keep tools sandboxed to the configured workspace.
- Keep command execution behind a strict allowlist.
- Do not add arbitrary shell execution.
- Do not add delete-file tools, full-disk access, credential access, browser-cookie access, or admin/system actions.
- Keep auth enabled by default.
- Keep no-auth development mode loopback-only and disabled by default.

## Before Opening a Pull Request

Run:

```powershell
npm run build
npm run smoke
git status
```

Review your diff for secrets and local details:

```powershell
git diff --cached --name-only
```

If your change touches security boundaries, explain the risk model in the pull request.

## Safe Areas To Improve

- Documentation and examples using placeholders only.
- Tests that use mocks or temporary sandbox folders.
- Better validation and error messages.
- Local-runtime adapters that keep auth and sandbox rules intact.

## Areas Requiring Extra Review

- Auth behavior.
- Workspace path checks.
- Command allowlist loading and execution.
- Output sanitization.
- Task submission and status handling.
- Any new endpoint or tool.
