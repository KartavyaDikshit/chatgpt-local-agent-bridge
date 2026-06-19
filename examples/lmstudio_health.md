# LM Studio Health

Configure your local OpenAI-compatible runtime:

```powershell
$env:BRIDGE_AUTH_TOKEN = "replace-with-your-local-token"
$env:LMSTUDIO_BASE_URL = "http://127.0.0.1:1234/v1"
npm start
```

Call the health endpoint:

```powershell
Invoke-RestMethod `
  -Headers @{ Authorization = "Bearer replace-with-your-local-token" } `
  http://127.0.0.1:8787/lmstudio_health
```

Expected result: JSON with `reachable` and HTTP status information.
