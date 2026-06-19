# Security Policy

Security guidance lives in [docs/security.md](docs/security.md).

Short version:

- Do not expose the bridge directly to the public internet.
- Keep authentication enabled by default.
- Use no-auth mode only for loopback-only local development.
- Never commit `.env`, secrets, logs, private endpoints, job files, browser data, or machine-specific paths.
- Keep file access inside the configured sandbox workspace.
- Keep command execution restricted to explicit allowlisted commands.
- Do not add arbitrary shell execution, delete tools, full-disk access, credential access, browser-cookie access, or admin/system actions.

## Reporting Security Issues

Please do not publish exploit details in a public issue. Open a minimal report that says a security issue exists and avoid including secrets, private URLs, logs, or local machine details.

If you maintain a private disclosure channel for your fork, document it here before accepting external use.
