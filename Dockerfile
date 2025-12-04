# Stage 1: Build UI
FROM node:18-alpine AS ui-build
WORKDIR /app/ui
COPY ui/package*.json ./
RUN npm install
COPY ui/ .
RUN npm run build

# Stage 2: Server
FROM node:18-alpine
WORKDIR /app/server
COPY server/package*.json ./
# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++
RUN npm install --production
COPY server/ .

# Copy built UI assets from Stage 1
# Create ui/dist directory structure in server parent
RUN mkdir -p ../ui/dist
COPY --from=ui-build /app/ui/dist ../ui/dist

# Create data directory for SQLite
RUN mkdir -p data

# Expose ports
# 4000: Proxy Worker
# 4001: Management API & UI
EXPOSE 4000 4001

# Start server
CMD ["npm", "start"]
