# Example cURL Commands for Testing FLUX

## Overview

FLUX runs on two ports:
- **Port 4000**: Proxy Worker (Express) - Handles all proxy traffic
- **Port 4001**: Management API (Fastify) - Manages scripts and targets

## Proxy Requests (Port 4000)

### 1. Simple GET Request

```bash
curl -X GET "http://localhost:4000/api/users?page=1" \
  -H "Content-Type: application/json"
```

### 2. POST Request with Body

```bash
curl -X POST http://localhost:4000/track/apm/v1/config \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "config": "value"
    }
  }'
```

### 3. POST Request with Gzipped Body

```bash
# Create and gzip a JSON file
echo '{"data": "test", "message": "hello"}' | gzip > request.json.gz

# Send gzipped request
curl -X POST http://localhost:4000/track/apm/txn \
  -H "Content-Type: application/json" \
  -H "Content-Encoding: gzip" \
  --data-binary @request.json.gz
```

### 4. PUT Request for Updates

```bash
curl -X PUT http://localhost:4000/api/users/123 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com"
  }'
```

### 5. DELETE Request

```bash
curl -X DELETE http://localhost:4000/api/users/123 \
  -H "Authorization: Bearer token123"
```

### 6. Request with Custom Headers

```bash
curl -X POST http://localhost:4000/api/data \
  -H "Content-Type: application/json" \
  -H "X-Custom-Header: custom-value" \
  -H "Authorization: Bearer token123" \
  -d '{
    "data": "test"
  }'
```

### 7. Request with Query Parameters

```bash
curl -X GET "http://localhost:4000/search?q=nodejs&limit=10" \
  -H "Accept: application/json"
```

## Scripts API Examples (Port 4001)

### List All Scripts

```bash
curl http://localhost:4001/api/scripts
```

Response:
```json
{
  "scripts": [
    {
      "name": "LicenseKeyInjector",
      "filename": "LicenseKeyInjector.js",
      "modifiedAt": "2025-12-04T06:00:00.000Z"
    }
  ]
}
```

### Get Specific Script

```bash
curl http://localhost:4001/api/scripts/LicenseKeyInjector
```

### Create New Script

```bash
curl -X POST http://localhost:4001/api/scripts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MyTransformation",
    "content": "export default { transformBody: (body) => ({ ...body, timestamp: Date.now() }) };"
  }'
```

### Update Script

```bash
curl -X PUT http://localhost:4001/api/scripts/MyTransformation \
  -H "Content-Type: application/json" \
  -d '{
    "content": "export default { transformBody: (body, metadata) => ({ ...body, version: \"2.0\", licenseKey: metadata.licenseKey }) };"
  }'
```

### Update Script Metadata (Tags & Description)

```bash
curl -X PUT http://localhost:4001/api/scripts/MyTransformation/metadata \
  -H "Content-Type: application/json" \
  -d '{
    "tags": ["apm", "production"],
    "description": "Adds license key and version to requests",
    "pathPattern": "^/track/.*"
  }'
```

### Delete Script

```bash
curl -X DELETE http://localhost:4001/api/scripts/MyTransformation
```

### Preview Transformation

```bash
curl -X POST http://localhost:4001/api/scripts/preview \
  -H "Content-Type: application/json" \
  -d '{
    "scriptName": "LicenseKeyInjector",
    "sampleData": {
      "headers": {
        "Content-Type": "application/json"
      },
      "params": {
        "userId": "123"
      },
      "body": {
        "message": "Hello World"
      }
    },
    "metadata": {
      "licenseKey": "lic_test_123abc",
      "environment": "staging"
    }
  }'
```

## Targets API Examples (Port 4001)

### List All Targets

```bash
curl http://localhost:4001/api/targets
```

### Get Specific Target

```bash
curl http://localhost:4001/api/targets/target-1
```

### Create New Target

```bash
curl -X POST http://localhost:4001/api/targets \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "Production Server",
    "baseUrl": "https://api.production.com",
    "tags": ["apm", "production"],
    "metadata": {
      "licenseKey": "lic_prod_abc123",
      "environment": "production",
      "region": "us-east-1"
    }
  }'
```

### Update Target

```bash
curl -X PUT http://localhost:4001/api/targets/target-1 \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "Updated Name",
    "baseUrl": "https://api.updated.com",
    "tags": ["apm", "staging"],
    "metadata": {
      "licenseKey": "lic_staging_xyz789",
      "environment": "staging"
    }
  }'
```

### Delete Target

```bash
curl -X DELETE http://localhost:4001/api/targets/target-1
```

## System Endpoints

### Health Check (Management API)

```bash
curl http://localhost:4001/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-12-04T06:30:00.000Z",
  "targets": 2,
  "scripts": 1
}
```

### Health Check (Proxy Worker)

```bash
curl http://localhost:4000/health
```

Response:
```json
{
  "status": "ok",
  "worker": true,
  "targets": 2
}
```

### System Info

```bash
curl http://localhost:4001/api/info
```

Response:
```json
{
  "version": "1.0.0",
  "targets": [
    {
      "baseUrl": "https://api.example1.com",
      "hasLicenseKey": true
    }
  ],
  "scripts": ["LicenseKeyInjector"],
  "config": {
    "port": 4000,
    "timeout": 30000
  }
}
```

## Testing Workflow

### 1. Start the Server

```bash
cd server
npm start
```

This starts both:
- Management API on port 4001
- Proxy Worker on port 4000

### 2. Create a Target (Optional - can also use UI)

```bash
curl -X POST http://localhost:4001/api/targets \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "Test Server",
    "baseUrl": "https://httpbin.org",
    "tags": ["test"],
    "metadata": {
      "licenseKey": "test-key-123"
    }
  }'
```

### 3. Create a Transformation Script

```bash
curl -X POST http://localhost:4001/api/scripts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AddTimestamp",
    "content": "export default { transformHeaders: (headers) => ({ ...headers, \"X-Timestamp\": new Date().toISOString() }) };"
  }'
```

### 4. Set Script Tags (to apply to specific targets)

```bash
curl -X PUT http://localhost:4001/api/scripts/AddTimestamp/metadata \
  -H "Content-Type: application/json" \
  -d '{
    "tags": ["test"],
    "description": "Adds timestamp header"
  }'
```

### 5. Test with Preview

```bash
curl -X POST http://localhost:4001/api/scripts/preview \
  -H "Content-Type: application/json" \
  -d '{
    "scriptName": "AddTimestamp",
    "sampleData": {
      "headers": { "Content-Type": "application/json" },
      "params": {},
      "body": { "test": true }
    }
  }'
```

### 6. Send Real Request Through Proxy

```bash
curl -X POST http://localhost:4000/post \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from proxy"}'
```

### 7. Verify Response

The response will show results from all configured targets:

```json
{
  "results": {
    "Test Server": {
      "status": 200,
      "statusText": "OK",
      "headers": {
        "content-type": "application/json"
      },
      "body": {
        "args": {},
        "headers": {
          "X-Timestamp": "2025-12-04T06:30:00.000Z",
          "Content-Type": "application/json"
        },
        "json": {
          "message": "Hello from proxy"
        }
      }
    }
  }
}
```

## Expected Response Format

### Successful Multi-Target Response

```json
{
  "results": {
    "Production API": {
      "status": 200,
      "statusText": "OK",
      "headers": {
        "content-type": "application/json",
        "x-request-id": "abc123"
      },
      "body": {
        "success": true,
        "data": "..."
      }
    },
    "Staging API": {
      "status": 200,
      "statusText": "OK",
      "headers": {
        "content-type": "application/json"
      },
      "body": {
        "success": true,
        "data": "..."
      }
    }
  }
}
```

### Response with Target Failure

If one target fails, others still complete:

```json
{
  "results": {
    "Production API": {
      "status": 200,
      "body": {
        "success": true
      }
    },
    "Staging API": {
      "status": 0,
      "error": "The operation was aborted due to timeout",
      "body": null
    }
  }
}
```

## Advanced Examples

### Testing Gzip Compression

```bash
# Create test data
echo '{"large": "data", "array": [1,2,3,4,5]}' > test.json

# Compress it
gzip -c test.json > test.json.gz

# Send compressed request
curl -X POST http://localhost:4000/track/apm/metric \
  -H "Content-Type: application/json" \
  -H "Content-Encoding: gzip" \
  --data-binary @test.json.gz

# The proxy will:
# 1. Decompress the gzipped body
# 2. Apply transformations
# 3. Re-compress the result
# 4. Forward to all targets with correct content-length
```

### Testing Tag-Based Filtering

```bash
# Create script that only applies to 'production' targets
curl -X PUT http://localhost:4001/api/scripts/ProdOnly/metadata \
  -H "Content-Type: application/json" \
  -d '{
    "tags": ["production"],
    "description": "Only runs for production targets"
  }'

# This script will only transform requests going to targets tagged with 'production'
```

### Testing Path Pattern Filtering

```bash
# Script only applies to paths matching /track/*
curl -X PUT http://localhost:4001/api/scripts/TrackingOnly/metadata \
  -H "Content-Type: application/json" \
  -d '{
    "pathPattern": "^/track/.*",
    "description": "Only applies to tracking endpoints"
  }'

# This request will trigger the script:
curl -X POST http://localhost:4000/track/apm/v1/config -d '{}'

# This request will NOT trigger the script:
curl -X POST http://localhost:4000/api/users -d '{}'
```

## Debugging Tips

### Enable Verbose Logging

Check the server console output for detailed logs:

```
📨 [Proxy Worker] Incoming POST request to /track/apm/txn
📡 [Proxy Worker] Broadcasting to all targets...
🔄 Transforming for Production API...
  → Running 1 script(s): LicenseKeyInjector
→ Broadcasting to https://api.example.com/track/apm/txn
  Method: POST, Headers: {...}
  Re-gzipped body: 107685 bytes → 17269 bytes
✓ Response from https://api.example.com/: 200 OK
✓ [Proxy Worker] Request completed in 461ms
```

### Test Individual Components

1. **Test transformation in isolation:**
   ```bash
   curl -X POST http://localhost:4001/api/scripts/preview ...
   ```

2. **Test target connectivity:**
   ```bash
   curl -X GET https://your-target-url/health
   ```

3. **Verify gzip handling:**
   Look for "Re-gzipped body" in logs

4. **Check script loading:**
   ```bash
   curl http://localhost:4001/api/scripts
   ```
