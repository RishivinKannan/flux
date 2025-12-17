# Response Selection Feature

## Overview

The Response Selection feature allows you to control which server response is sent to the client. Response selection is configured **per-script**, so each transformation script can have its own response behavior.

## How It Works

1. Create or edit a transformation script
2. Expand the **Response Selection** section
3. Enable response selection and choose a strategy
4. Save the script

When a request matches a script with response selection enabled, that script's strategy is applied.

## Available Strategies

| Strategy | Icon | Description |
|----------|------|-------------|
| **All Responses** | 📊 | Return all target responses (default) |
| **Specific Target** | 🎯 | Return response from one selected target |
| **First Response** | ⚡ | Return the fastest response |
| **Mock Response** | 🎭 | Return a custom mock response |

## UI Configuration

1. Navigate to http://localhost:4001
2. Click **Scripts** → Create or Edit a script
3. Expand **Response Selection** section
4. Toggle **Enable Response Selection**
5. Click a strategy card to select it
6. Configure additional options if needed:
   - **Specific**: Choose target from dropdown
   - **Mock**: Edit JSON in the Monaco editor
7. Click **Save Script**

## Response Format

### When Disabled (Default)

```json
{
  "results": {
    "Production API": { "status": 200, "body": {...} },
    "Staging API": { "status": 200, "body": {...} }
  }
}
```

### When Enabled

```json
{
  "selectedTarget": "Production API",
  "strategy": "specific",
  "status": 200,
  "body": {...}
}
```

## Technical Details

- Response config stored in `scripts` table per-script
- First matching script with enabled config wins
- Scripts are matched by path pattern regex
- Backward compatible when disabled
