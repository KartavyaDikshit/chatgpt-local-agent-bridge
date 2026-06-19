# Basic Status Check

```powershell
$env:BRIDGE_AUTH_TOKEN = "replace-with-your-local-token"
npm start
```

In another terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/status
```

Expected result: JSON with bridge name, version, auth requirement, workspace mode, and available tools.
