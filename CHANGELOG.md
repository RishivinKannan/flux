# Changelog

All notable changes to the FLUX project.

## [0.1.0] - 2025-12-04

### 🎉 Major Release - Architecture Overhaul

This release represents a complete rewrite of the proxy architecture with significant improvements in performance, reliability, and functionality.

### ✨ Added

#### Express Worker Architecture
- **NEW**: Proxy traffic now handled by Express.js server in a worker thread
- **NEW**: Isolated proxy worker on port 4000 for improved performance
- **NEW**: Management API (Fastify) on separate port 4001
- **Benefit**: Better isolation, reliability, and scalability

#### Gzip Compression Handling
- **NEW**: Automatic detection of gzipped request bodies (`content-encoding: gzip`)
- **NEW**: Smart decompression → transformation → re-compression pipeline
- **NEW**: Automatic `content-length` header updates after re-compression
- **Performance**: Maintains compression benefits while enabling transformations
- **Example**: 107KB JSON → 17KB gzipped after transformation

#### Tag-Based Script Filtering
- **NEW**: Scripts can be tagged to apply only to specific targets
- **NEW**: Targets can be tagged to receive specific transformations
- **NEW**: Path pattern matching with regex support (`pathPattern` field)
- **Use Case**: Apply different transformations to production vs staging environments

#### Targets Management
- **NEW**: Complete CRUD API for managing proxy targets
- **NEW**: Web UI for creating and editing targets
- **NEW**: Target metadata support for custom key-value pairs
- **NEW**: Target nicknames for better identification
- **NEW**: Unique target IDs for reliable referencing

#### Enhanced Transformation Scripts
- **NEW**: Transformation functions now receive target metadata
- **NEW**: Access to environment-specific configuration in scripts
- **NEW**: Script metadata storage (tags, description, pathPattern)
- **NEW**: Hot-reload support for metadata changes

### 🔧 Changed

#### Port Configuration
- **BREAKING**: Proxy endpoint moved from `:3000` to `:4000`
- **BREAKING**: Management API now on `:4001` (was `:3000`)
- **Migration**: Update client configurations to use new ports

#### URL Handling
- **CHANGED**: Proxy now accepts ALL paths (not just `/proxy/*` or `/track/*`)
- **IMPROVED**: Better URL construction with trailing slash handling
- **FIXED**: Double slash issues in forwarded URLs

#### Response Format
- **CHANGED**: Aggregated responses now use target nicknames as keys (not hostnames)
- **IMPROVED**: More descriptive error messages with stack traces
- **ADDED**: Response timing information in logs

### 🐛 Fixed

#### Critical Fixes
- **FIXED**: 30-second timeout issue caused by content-encoding header mismatch
- **FIXED**: Requests with gzipped bodies now complete in ~460ms (was timing out)
- **FIXED**: Script deletion now properly updates metadata file
- **FIXED**: Race condition when reloading scripts after deletion
- **FIXED**: `scripts-metadata.js` no longer appears in scripts list

#### Minor Fixes
- **FIXED**: Duplicate route registration errors
- **FIXED**: Content-Length mismatch errors
- **FIXED**: Script syntax validation being too strict
- **FIXED**: UI blank screen after script operations

### 📝 Documentation

- **ADDED**: Comprehensive README with architecture diagrams
- **ADDED**: EXAMPLES.md with updated curl commands for new ports
- **ADDED**: Detailed gzip handling documentation
- **ADDED**: Tag-based filtering examples
- **ADDED**: Walkthrough document for development process
- **UPDATED**: All code examples to reflect new architecture

### 🔒 Security

- **IMPROVED**: Script validation before execution
- **IMPROVED**: Safe script execution environment
- **ADDED**: Error isolation between main process and worker thread

### ⚡ Performance

- **IMPROVED**: Proxy traffic isolated in worker thread (better CPU utilization)
- **IMPROVED**: Gzip handling preserves compression benefits
- **IMPROVED**: File watching with optimized reload logic
- **METRIC**: Request completion time: 30s timeout → ~460ms average

### 🗑️ Deprecated

- **DEPRECATED**: `/proxy/*` route prefix (all paths now supported)
- **MIGRATION**: Update clients to send requests to `http://localhost:4000/*` directly

---

## [1.0.0] - 2024-XX-XX

### Initial Release

- Basic proxy functionality with Fastify
- Simple license key injection
- Script management API
- React-based web UI with Monaco Editor
- Hot-reload support for transformation scripts
- Multi-host broadcasting
- Preview tester for safe script testing

---

## Migration Guide: v1 → v2

### 1. Update Port Configuration

**Before (v1.x):**
```
Proxy: http://localhost:3000/proxy/*
```

**After (v2.0):**
```
Proxy: http://localhost:4000/*
Management API: http://localhost:4001/api/*
```

### 2. Update Target Configuration

**Before (v1.x):**
```json
{
  "targets": [
    {
      "baseUrl": "https://api.example.com",
      "licenseKey": "key123"
    }
  ]
}
```

**After (v2.0):**
```json
{
  "targets": [
    {
      "id": "target-1",
      "nickname": "Production API",
      "baseUrl": "https://api.example.com",
      "tags": ["apm", "production"],
      "metadata": {
        "licenseKey": "key123",
        "environment": "production"
      }
    }
  ]
}
```

### 3. Update Transformation Scripts

**Before (v1.x):**
```javascript
export default {
  transformBody: (body) => ({
    ...body,
    licenseKey: "hardcoded-key"
  })
};
```

**After (v2.0):**
```javascript
export default {
  transformBody: (body, metadata) => ({
    ...body,
    licenseKey: metadata.licenseKey,
    environment: metadata.environment
  })
};
```

### 4. Update Client Requests

**Before (v1.x):**
```bash
curl http://localhost:3000/proxy/api/users
```

**After (v2.0):**
```bash
curl http://localhost:4000/api/users
```

---

## Upgrade Instructions

### From v1.x to v2.0

1. **Backup your configuration:**
   ```bash
   cp server/config.json server/config.json.backup
   cp -r server/scripts server/scripts.backup
   ```

2. **Install new dependencies:**
   ```bash
   cd server
   npm install express
   ```

3. **Update config.json:**
   - Add `id` and `nickname` fields to each target
   - Move `licenseKey` into `metadata` object
   - Add `tags` arrays as needed

4. **Update transformation scripts:**
   - Add `metadata` parameter to transformation functions
   - Replace hardcoded values with `metadata.xxx`

5. **Update client code:**
   - Change proxy URL from `:3000/proxy/*` to `:4000/*`
   - Change API calls from `:3000/api/*` to `:4001/api/*`

6. **Restart services:**
   ```bash
   cd server
   npm start
   ```

---

## Breaking Changes Summary

1. **Port Changes**: Proxy (3000→4000), Management API (3000→4001)
2. **URL Format**: `/proxy/*` → `/*` (all paths supported)
3. **Config Format**: `licenseKey` → `metadata.licenseKey`
4. **Response Format**: Hostname keys → Nickname keys
5. **Script Signature**: Added `metadata` parameter to transform functions

---

## Contributors

Special thanks to all contributors who helped make this release possible!

---

**Full Changelog**: https://github.com/RishivinKannan/flux/compare/v1.0.0...v2.0.0
