FROM node:18-alpine AS builder

# Install Python and build dependencies
RUN apk add --no-cache python3 py3-pip build-base linux-headers

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src
COPY scripts ./scripts

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

# Install Python and runtime dependencies
RUN apk add --no-cache python3 py3-pip

# Install Reticulum
RUN pip3 install --no-cache-dir rns

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/scripts ./scripts
COPY package*.json ./

# Create directories
RUN mkdir -p logs mqtt-data certs

# Expose ports
EXPOSE 1883 8883 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run as non-root user
RUN addgroup -g 1001 icenet && \
    adduser -D -u 1001 -G icenet icenet && \
    chown -R icenet:icenet /app

USER icenet

CMD ["node", "dist/index.js"]
