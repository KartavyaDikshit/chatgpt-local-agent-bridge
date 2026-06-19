## Summary

Describe the change.

## Validation

- [ ] `npm run build`
- [ ] `npm run smoke`

## Security Checklist

- [ ] No `.env`, `.env.*`, logs, job files, credentials, cookies, tokens, API keys, private endpoints, private IPs, usernames, emails, or local machine paths are included.
- [ ] Auth remains enabled by default.
- [ ] No-auth mode remains loopback-only development behavior.
- [ ] File access remains sandboxed.
- [ ] Command execution remains allowlisted.
- [ ] No arbitrary shell execution was added.
- [ ] No delete-file, full-disk, credential, browser-cookie, or admin/system tools were added.

## Notes For Reviewers

Call out any changes to auth, sandboxing, command execution, output sanitization, task handling, or local-runtime access.
