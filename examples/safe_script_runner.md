# Safe Script Runner

Commands must be declared by ID in `config/allowed_commands.example.json`.

Example request:

```powershell
Invoke-RestMethod `
  -Method POST `
  -Headers @{ Authorization = "Bearer replace-with-your-local-token" } `
  -ContentType "application/json" `
  -Body '{"command_id":"node_version"}' `
  http://127.0.0.1:8787/run_allowed_script
```

Expected result: JSON with the command ID, exit code, stdout, and stderr.

Do not add destructive commands to the allowlist.
