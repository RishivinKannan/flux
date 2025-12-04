# FLUX: Multi-Host Proxy Server with Transformation Engine

A production-ready Node.js proxy server that broadcasts HTTP requests to multiple target hosts simultaneously, with a complete transformation script management system and web UI.

## 🌟 Features

- **Multi-Host Broadcasting**: Simultaneously forward requests to multiple configured targets
- **Request Transformation**: Modify headers, query parameters, and body before forwarding
- **Gzip Support**: Automatic compression/decompression handling for transformed requests
- **Tag-Based Script Filtering**: Apply different transformations based on target tags
- **Hot-Reload Scripts**: Changes to transformation scripts apply instantly without server restart
- **License Key Injection**: Automatically inject target-specific license keys or API keys
- **Express Worker Architecture**: Isolated proxy worker thread for better performance and reliability
- **Web UI**: Beautiful React interface for managing transformation scripts and targets
- **Monaco Editor**: Professional code editor with syntax highlighting
- **Preview Tester**: Test transformations in a sandbox before deployment
- **Safe Execution**: Validated script execution environment

## 📋 Requirements

- Node.js 18+ (for native fetch support)
- npm or yarn

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../ui
npm install
```

### 2. Configure Targets

Edit `server/config.json` to add your target hosts:

```json
{
  "port": 4000,
  "targets": [
    {
      "id": "target-1",
      "nickname": "Production API",
      "baseUrl": "https://api.example1.com",
      "tags": ["apm", "production"],
      "metadata": {
        "licenseKey": "your-license-key-1",
        "environment": "production"
      }
    },
    {
      "id": "target-2",
      "nickname": "Staging API",
      "baseUrl": "https://api.example2.com",
      "tags": ["apm", "staging"],
      "metadata": {
        "licenseKey": "your-license-key-2",
        "environment": "staging"
      }
    }
  ],
  "scriptTimeout": 5000,
  "requestTimeout": 30000
}
```

### 3. Start the Server

```bash
# Start backend (runs both servers)
cd server
npm start

# In another terminal - Start frontend (development)
cd ui
npm run dev
```

**Services:**
- **FLUX Proxy (Express)**: http://localhost:4000 - Handles all proxy traffic
- **Management API (Fastify)**: http://localhost:4001 - Manages scripts and targets
- **Frontend**: http://localhost:5173 - Web UI for configuration

## 🏗️ Architecture

### Dual-Server Design

The application uses a **worker thread architecture** for isolation and performance:

```
┌─────────────────────────────────────────┐
│   Main Process (Fastify - Port 4001)   │
│  ┌───────────────────────────────────┐  │
│  │  Management API                   │  │
│  │  - Scripts CRUD (/api/scripts)    │  │
│  │  - Targets CRUD (/api/targets)    │  │
│  │  - Static UI Files (/)            │  │
│  └───────────────────────────────────┘  │
│             │                            │
│             │ Spawns Worker Thread       │
│             ▼                            │
│  ┌───────────────────────────────────┐  │
│  │   Proxy Worker (Express - 4000)   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  Proxy Traffic Handler      │  │  │
│  │  │  - Receives all requests    │  │  │
│  │  │  - Applies transformations  │  │  │
│  │  │  - Broadcasts to targets    │  │  │
│  │  │  - Handles gzip compression │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Benefits:**
- **Isolation**: Proxy traffic processing isolated from management operations
- **Performance**: Worker thread doesn't block the main event loop
- **Reliability**: If proxy worker crashes, management API stays running
- **Scalability**: Can easily scale to multiple workers if needed

### Request Flow

```
Client Request (gzipped)
    │
    ▼
Express Worker (Port 4000)
    │
    ├─► Decompress (if gzipped)
    ├─► Parse JSON
    ├─► Apply Tag-Filtered Transformations
    ├─► Re-compress (if was gzipped)
    └─► Broadcast to All Targets
         │
         ├─► Target 1: https://api.example1.com
         ├─► Target 2: https://api.example2.com
         └─► Target N: ...
              │
              ▼
         Aggregate Responses
              │
              ▼
         Return to Client
```

## 📁 Project Structure

```
flux/
├── server/
│   ├── server.js              # Main Fastify server (Management API)
│   ├── proxy-worker.js        # Express proxy worker
│   ├── config.json            # Target configuration
│   ├── package.json
│   ├── lib/
│   │   ├── script-loader.js      # Hot-reload script loader
│   │   ├── transformation-engine.js  # Transformation orchestration
│   │   └── distributor.js        # Multi-host broadcaster with gzip handling
│   ├── api/
│   │   ├── scripts.js         # Scripts CRUD API
│   │   └── targets.js         # Targets CRUD API
│   └── scripts/
│       ├── scripts-metadata.js   # Script metadata storage
│       └── LicenseKeyInjector.js # Example transformation
└── ui/
    ├── src/
    │   ├── App.jsx
    │   ├── main.jsx
    │   ├── index.css
    │   ├── pages/
    │   │   ├── ScriptList.jsx
    │   │   ├── ScriptEditor.jsx
    │   │   ├── TargetList.jsx
    │   │   ├── TargetEditor.jsx
    │   │   └── PreviewTester.jsx
    │   └── services/
    │       └── api.js
    ├── index.html
    ├── vite.config.js
    └── package.json
```

## 🔧 API Endpoints

### Proxy Endpoint (Port 4000)

```bash
# All HTTP methods supported: GET, POST, PUT, PATCH, DELETE
# Matches ALL paths
http://localhost:4000/*
```

**Example:**
```bash
curl -X POST http://localhost:4000/track/apm/v1/config \
  -H "Content-Type: application/json" \
  -H "Content-Encoding: gzip" \
  --data-binary @request.json.gz
```

**Response:**
```json
{
  "results": {
    "Production API": {
      "status": 200,
      "statusText": "OK",
      "body": { "success": true }
    },
    "Staging API": {
      "status": 200,
      "statusText": "OK",
      "body": { "success": true }
    }
  }
}
```

### Management API (Port 4001)

**Scripts Management:**
```bash
GET    /api/scripts              # List all scripts
GET    /api/scripts/:name        # Get script content
POST   /api/scripts              # Create new script
PUT    /api/scripts/:name        # Update script
DELETE /api/scripts/:name        # Delete script
PUT    /api/scripts/:name/metadata  # Update script metadata
POST   /api/scripts/preview      # Test transformation
```

**Targets Management:**
```bash
GET    /api/targets              # List all targets
GET    /api/targets/:id          # Get target details
POST   /api/targets              # Create new target
PUT    /api/targets/:id          # Update target
DELETE /api/targets/:id          # Delete target
```

**System Endpoints:**
```bash
GET /health      # Health check
GET /api/info    # System information
```

## 📝 Writing Transformation Scripts

Transformation scripts are ES6 modules that export transformation functions with access to target metadata:

```javascript
/**
 * Example transformation script
 */
export default {
  /**
   * Transform request headers
   * @param {Object} headers - Original headers
   * @param {Object} metadata - Target-specific metadata
   */
  transformHeaders: (headers, metadata) => {
    return {
      ...headers,
      'X-API-Key': metadata.licenseKey,
      'X-Environment': metadata.environment,
      'X-Timestamp': new Date().toISOString()
    };
  },

  /**
   * Transform query parameters
   * @param {Object} params - Original query params
   * @param {Object} metadata - Target-specific metadata
   */
  transformParams: (params, metadata) => {
    return {
      ...params,
      licenseKey: metadata.licenseKey,
      apiVersion: '2.0',
      timestamp: Date.now()
    };
  },

  /**
   * Transform request body
   * @param {Object} body - Original request body
   * @param {Object} metadata - Target-specific metadata
   */
  transformBody: (body, metadata) => {
    if (!body) return body;
    
    return {
      ...body,
      licenseKey: metadata.licenseKey,
      metadata: {
        transformed: true,
        transformedAt: new Date().toISOString(),
        environment: metadata.environment
      }
    };
  }
};
```

**Key Points:**
- Each function is **optional** - only include what you need
- Functions receive the original data AND target metadata
- Changes are **hot-reloaded** automatically
- Use the Preview Tester to test safely before deploying

## 🏷️ Tag-Based Script Filtering

Scripts can be configured to apply only to targets with specific tags:

**In the UI:**
1. Edit a script
2. Add tags (e.g., `apm`, `production`, `staging`)
3. Save

**Script Metadata:**
```javascript
// scripts-metadata.js
export default {
  "LicenseKeyInjector": {
    "description": "Injects license keys into requests",
    "tags": ["apm"],  // Only applies to targets with 'apm' tag
    "pathPattern": "^/track/.*"  // Only applies to paths matching regex
  }
};
```

**Filtering Logic:**
- If script has **no tags**: applies to ALL targets
- If script has **tags**: applies only to targets with matching tags
- If script has **path pattern**: applies only to requests matching the regex

## 🗜️ Gzip Handling

The proxy automatically handles gzipped requests:

1. **Detection**: Checks for `content-encoding: gzip` header
2. **Decompression**: Automatically decompresses gzipped request bodies
3. **Transformation**: Applies all transformations to the decompressed data
4. **Re-compression**: Re-compresses the transformed data with gzip
5. **Header Update**: Sets correct `content-length` for the new compressed body

**Example Log:**
```
Re-gzipped body: 107685 bytes → 17269 bytes
✓ Response from https://demo.atatus.com/: 200 OK
✓ Request completed in 461ms
```

**Benefits:**
- Preserves original compression
- Reduces bandwidth usage
- Compatible with clients expecting gzipped responses
- Automatic - no configuration needed

## 🔑 License Key / API Key Injection

The system can inject target-specific credentials through the metadata:

**Configure in Target:**
```json
{
  "nickname": "Production",
  "baseUrl": "https://api.example.com",
  "metadata": {
    "licenseKey": "lic_prod_123abc",
    "apiKey": "api_key_xyz"
  }
}
```

**Use in Transformation Script:**
```javascript
export default {
  transformHeaders: (headers, metadata) => ({
    ...headers,
    'X-API-Key': metadata.apiKey,
    'Authorization': `Bearer ${metadata.licenseKey}`
  }),
  
  transformParams: (params, metadata) => ({
    ...params,
    licenseKey: metadata.licenseKey
  }),
  
  transformBody: (body, metadata) => ({
    ...body,
    credentials: {
      licenseKey: metadata.licenseKey,
      apiKey: metadata.apiKey
    }
  })
};
```

## 💡 Example Use Cases

### 1. APM/Observability Platform Integration

```javascript
export default {
  transformHeaders: (headers, metadata) => ({
    ...headers,
    'X-License-Key': metadata.licenseKey,
    'X-App-Name': metadata.appName || 'default'
  }),
  
  transformBody: (body, metadata) => ({
    ...body,
    licenseKey: metadata.licenseKey,
    environment: metadata.environment
  })
};
```

### 2. Multi-Environment Testing

Route requests to multiple environments:
- **Target 1**: Production (tag: `production`)
- **Target 2**: Staging (tag: `staging`)
- **Target 3**: Development (tag: `development`)

Apply environment-specific transformations using tags.

### 3. A/B Testing

Send identical requests to different API versions:
```javascript
export default {
  transformParams: (params, metadata) => ({
    ...params,
    version: metadata.apiVersion || '1.0',
    experiment: metadata.experimentId
  })
};
```

## 🧪 Testing Transformations

### Using the Web UI

1. Navigate to \"Preview Tester\"
2. Select a transformation script
3. Enter sample headers, params, and body (JSON format)
4. Click \"Test Transformation\"
5. View the before/after comparison

### Using the API

```bash
curl -X POST http://localhost:4001/api/scripts/preview \
  -H \"Content-Type: application/json\" \
  -d '{
    \"scriptName\": \"LicenseKeyInjector\",
    \"sampleData\": {
      \"headers\": {\"Content-Type\": \"application/json\"},
      \"params\": {\"userId\": \"123\"},
      \"body\": {\"message\": \"Hello\"}
    },
    \"metadata\": {
      \"licenseKey\": \"test-key-123\",
      \"environment\": \"staging\"
    }
  }'
```

## 🏗️ Production Deployment

### Build Frontend

```bash
cd ui
npm run build
```

The built files will be in `ui/dist` and automatically served by the management server at `/`.

### Run in Production

```bash
cd server
NODE_ENV=production npm start
```

### Environment Variables

```bash
# Optional: Override config file
export CONFIG_PATH=/path/to/config.json

# Optional: Set node environment
export NODE_ENV=production
```

### Process Management

Use PM2 for production process management:

```bash
npm install -g pm2

# Start the server
pm2 start server.js --name flux

# View logs
pm2 logs flux

# Monitor
pm2 monit

# Restart
pm2 restart flux
```

## 🔒 Security Considerations

- **Script Validation**: All scripts are validated before execution
- **Syntax Checking**: Scripts are checked for syntax errors before saving
- **Safe Execution**: Transformation functions run in a controlled environment
- **CORS**: Enabled by default for the management API
- **Network Isolation**: Proxy worker runs in separate thread

## 🛡️ Error Handling

- **Script Errors**: Malformed scripts are caught and reported without crashing
- **Target Failures**: If one target fails, others continue processing
- **Transformation Errors**: Failed transformations fall back to original data
- **Gzip Errors**: Compression errors are logged and requests proceed without compression
- **Worker Crashes**: Main server stays running if worker thread crashes

## 📊 Monitoring & Debugging

**Check Health:**
```bash
# Management server
curl http://localhost:4001/health

# Proxy worker
curl http://localhost:4000/health
```

**View Detailed Logs:**
The server outputs detailed logs including:
- Request URLs and methods
- Transformation script execution
- Gzip compression statistics
- Response status codes
- Error stack traces

**Example Log Output:**
```
📨 [Proxy Worker] Incoming POST request to /track/apm/v1/config
📡 [Proxy Worker] Broadcasting to all targets...
🔄 Transforming for Production API...
  → Running 1 script(s): LicenseKeyInjector
→ Broadcasting to https://api.example.com/track/apm/v1/config
  Method: POST, Headers: {...}
  Re-gzipped body: 107685 bytes → 17269 bytes
✓ Response from https://api.example.com/: 200 OK
✓ [Proxy Worker] Request completed in 461ms
```

## 🐛 Troubleshooting

### Ports Already in Use

Change ports in `server.js`:
- Proxy worker: Currently set to 4000
- Management API: Currently set to 4001

### Scripts Not Loading

- Check `server/scripts/` directory exists
- Verify `.js` files have proper ES6 export syntax
- View server logs for error messages
- Check `scripts-metadata.js` for script entries

### Gzip Issues

The server automatically detects and handles gzipped content. If issues occur:
- Check `content-encoding` header in requests
- View logs for \"Re-gzipped body\" messages
- Verify compression is actually needed

### Target Timeouts

Default timeout is 30 seconds. Adjust in `config.json`:
```json
{
  "requestTimeout": 60000
}
```

## 🔧 Technology Stack

- **FLUX Proxy**: Express 5 (in worker thread)
- **Management API**: Fastify 4
- **HTTP Client**: Native Node.js `fetch`
- **Compression**: Node.js `zlib` module
- **Worker Threads**: Node.js `worker_threads`
- **Frontend**: React + Vite
- **Code Editor**: Monaco Editor
- **File Watching**: Chokidar

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please:
1. Test transformations with the Preview Tester
2. Document your changes
3. Follow existing code style
4. Add examples for new features

## 📞 Support

For issues or questions:
- Check server logs for error messages
- Use `/health` endpoints for system status
- Test transformations with Preview Tester
- Review this documentation

---

Built with ⚡ Fastify, 🚀 Express, ⚛️ React, and 💙 by developers, for developers.
