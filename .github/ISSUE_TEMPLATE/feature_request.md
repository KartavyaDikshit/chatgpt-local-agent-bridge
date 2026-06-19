---
name: Feature request
about: Suggest a safe improvement
title: "[Feature]: "
labels: enhancement
assignees: ""
---

## Summary

What should the bridge be able to do?

## Use Case

Explain the local-first workflow this supports.

## Proposed Safety Model

How should the feature preserve:

- auth on by default
- sandboxed workspace access
- command allowlisting
- no arbitrary shell execution
- no credential, cookie, or full-disk access
- no private endpoint assumptions

## Alternatives Considered

Describe any safer or simpler options.

## Safety Checklist

- [ ] This does not require secrets in the repo.
- [ ] This does not require unrestricted shell commands.
- [ ] This does not require destructive file operations.
- [ ] This can be tested with placeholders, mocks, or a sandbox workspace.
