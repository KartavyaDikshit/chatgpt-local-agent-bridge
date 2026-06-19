# Security

This project is intentionally conservative. Treat it as a local experiment, not a production remote-control service.

## Defaults

- Authentication is required by default.
- No-auth mode is disabled by default.
- The default host is loopback.
- File access is limited to a configured sandbox workspace.
- Shell execution is not available.
- Script execution is limited to exact command IDs in a JSON allowlist.

## Development No-Auth Mode

`ALLOW_NO_AUTH_LOOPBACK=true` disables auth only for loopback requests. Do not use this when tunneling, sharing your network, or exposing the bridge outside your own machine.

## Filesystem Rules

- Absolute paths are rejected.
- Path traversal outside the sandbox is rejected.
- Credential-looking filenames are hidden from directory listings.
- `write_note` only writes `.md` and `.txt` files.
- There are no delete tools.

## Command Rules

- Commands are selected by ID.
- Commands run with `shell: false`.
- Command output is length-limited.
- Do not place destructive commands in the allowlist.

## Output Sanitization

The bridge redacts common token, password, cookie, email, private IP, and local-path patterns from returned text. Sanitization is a safety net, not a substitute for keeping secrets out of the workspace.

## Public Internet Warning

Do not expose the bridge directly to the public internet. If you use a tunnel for experimentation, put strong authentication and additional network access controls in front of it.

## Before Publishing Your Fork

- Remove logs and generated files.
- Remove personal paths and endpoints.
- Replace real tokens with placeholders.
- Run the smoke test.
- Run a secret scan.
