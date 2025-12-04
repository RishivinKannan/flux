# Release Summary: v2.0.0

## 📦 FLUX v2.0.0

**Release Date**: December 4, 2025  
**Type**: Major Release - Architecture Overhaul

---

## 🎯 Overview

This is a major release featuring a complete architectural redesign of the proxy server. The most significant changes include migrating to an Express-based worker thread architecture, implementing sophisticated gzip handling, and adding tag-based script filtering.

---

## ⚡ Key Improvements

### Performance
- **65x faster request processing**: From 30-second timeouts to ~460ms average response time
- **Isolated worker thread**: Proxy traffic no longer blocks management operations
- **Optimized gzip handling**: Maintains compression benefits while enabling transformations

### Reliability
- **Better error isolation**: Worker crashes don't affect management API
- **Automatic recovery**: Worker can be restarted independently
- **Improved error reporting**: Detailed logging with stack traces

### Functionality
- **Universal proxy**: All paths supported (not just `/proxy/*` or `/track/*`)
- **Tag-based filtering**: Apply transformations selectively based on target tags
- **Path pattern matching**: Scripts can filter by URL patterns using regex
- **Gzip intelligence**: Automatic compression/decompression pipeline

---

## 🚨 Breaking Changes

### Port Configuration
- **Proxy Worker**: Port 4000 (was 3000)
- **Management API**: Port 4001 (was 3000)

### Configuration Format
```json
// OLD
{
  "targets": [{
    "baseUrl": "https://api.example.com",
    "licenseKey": "key123"
  }]
}

// NEW
{
  "targets": [{
    "id": "target-1",
    "nickname": "Production API",
    "baseUrl": "https://api.example.com",
    "tags": ["apm", "production"],
    "metadata": {
      "licenseKey": "key123"
    }
  }]
}
```

### Script Signatures
```javascript
// OLD
transformBody: (body) => ({ ...body })

// NEW
transformBody: (body, metadata) => ({ 
  ...body, 
  licenseKey: metadata.licenseKey 
})
```

---

## 📚 Documentation

All documentation has been updated:

- **README.md**: Complete rewrite with architecture diagrams
- **EXAMPLES.md**: Updated with new ports and advanced examples
- **CHANGELOG.md**: Detailed changelog with migration guide
- **RELEASE.md**: This summary document

---

## 🔄 Migration Guide

### Quick Migration (5 minutes)

1. **Update client URLs:**
   ```diff
   - http://localhost:3000/proxy/api/users
   + http://localhost:4000/api/users
   ```

2. **Update config.json:**
   ```bash
   # Backup first
   cp server/config.json server/config.json.backup
   
   # Add required fields to each target:
   # - id
   # - nickname  
   # - tags (array)
   # Move licenseKey into metadata object
   ```

3. **Update transformation scripts:**
   ```diff
   - transformBody: (body) => ({ ...body, key: "hardcoded" })
   + transformBody: (body, metadata) => ({ ...body, key: metadata.licenseKey })
   ```

4. **Restart:**
   ```bash
   cd server
   npm start
   ```

---

## 🎁 New Features

### 1. Express Worker Architecture
- Proxy traffic handled in isolated worker thread
- Better CPU utilization and fault tolerance
- Independent scaling of proxy and management operations

### 2. Intelligent Gzip Handling
- Automatic detection and decompression
- Apply transformations to uncompressed data
- Re-compress with correct content-length
- **Example**: 107KB JSON → 17KB gzipped

### 3. Tag-Based Script Filtering
```javascript
// Script metadata
{
  "tags": ["production", "apm"],
  "pathPattern": "^/track/.*"
}

// Only applies to targets with matching tags
// and paths matching the regex
```

### 4. Enhanced Targets Management
- Full CRUD API for targets
- Web UI for target management
- Rich metadata support
- Persistent configuration

---

## 🐛 Critical Fixes

1. **Timeout Issue**: Fixed 30-second timeouts caused by content-encoding mismatch
2. **URL Construction**: Fixed double slash issues in forwarded URLs
3. **Script Deletion**: Properly cleans up metadata files
4. **Race Conditions**: Fixed script reload race conditions

---

## 📊 Performance Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Request Time (with gzip) | 30s timeout | ~460ms | **65x faster** |
| Memory Usage (proxy) | Shared | Isolated | **Better stability** |
| Script Reload | Manual restart | Hot-reload | **Instant** |
| Gzip Compression | Broken | Working | **100% functional** |

---

## 🛠️ Technical Stack

- **Proxy**: Express 5 (worker thread)
- **Management**: Fastify 4 (main process)
- **Compression**: Node.js zlib
- **Worker**: Node.js worker_threads
- **Frontend**: React + Vite + Monaco Editor

---

## ✅ Testing

All features have been tested:

- ✅ Multi-target broadcasting
- ✅ Gzip compression/decompression
- ✅ Tag-based script filtering  
- ✅ Path pattern matching
- ✅ Hot-reload functionality
- ✅ Target CRUD operations
- ✅ Script CRUD operations
- ✅ Worker thread isolation
- ✅ Error handling and recovery

---

## 📦 Installation

```bash
# Clone repository
git clone https://github.com/RishivinKannan/flux.git
cd flux

# Install dependencies
cd server && npm install
cd ../ui && npm install

# Start server
cd ../server && npm start

# In another terminal, start UI (development)
cd ui && npm run dev
```

---

## 🔗 Quick Links

- [Full Changelog](./CHANGELOG.md)
- [README](./README.md)
- [Examples](./EXAMPLES.md)
- [Migration Guide](./CHANGELOG.md#migration-guide-v1--v2)

---

## 🙏 Acknowledgments

This release represents significant improvements based on real-world usage and feedback. Special thanks to all contributors and testers!

---

## 📞 Support

For issues or questions:
- Check [EXAMPLES.md](./EXAMPLES.md) for usage examples
- Review [CHANGELOG.md](./CHANGELOG.md) for migration help
- Use `/health` endpoints to verify system status

---

**Happy Proxying! 🚀**
