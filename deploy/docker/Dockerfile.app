# ==============================================================================
# BIOAZÚCAR 4.0 — CENTRAL INDUSTRIAL PLATFORM CONTAINER
# ==============================================================================
# Architecture: Multi-stage, minimal attack surface, non-root execution.
# Compliant with IEC 62443-3-3 System Security Requirements.

# Stage 1: Build & Compilation
FROM node:20-alpine AS builder

WORKDIR /app

# Dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Source files
COPY . .

# Build Vite frontend and bundled Node CommonJS server
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner

LABEL maintainer="BioAzúcar 4.0 Industrial Systems <engineering@bioazucar40.com>"
LABEL version="4.0.0-prod"
LABEL description="BioAzúcar 4.0 Central Industrial SCADA & MES Platform"

WORKDIR /app

# Create dedicated non-root industrial service account
RUN addgroup -S -g 10001 bioazucar && \
    adduser -S -u 10001 -G bioazucar -h /app bioazucar

# Prepare persistent data and logs directories
RUN mkdir -p /app/data /app/logs /app/certs && \
    chown -R bioazucar:bioazucar /app

# Copy production artifacts from builder
COPY --from=builder --chown=bioazucar:bioazucar /app/dist ./dist
COPY --from=builder --chown=bioazucar:bioazucar /app/package.json ./package.json
COPY --from=builder --chown=bioazucar:bioazucar /app/node_modules ./node_modules
COPY --from=builder --chown=bioazucar:bioazucar /app/data ./data

# Switch to non-root user
USER bioazucar

# Production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV BIOAZUCAR_DATA_DIR=/app/data
ENV BIOAZUCAR_LOG_DIR=/app/logs

EXPOSE 3000

# Deterministic Health Check
HEALTHCHECK --interval=20s --timeout=4s --retries=3 --start-period=15s \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["node", "dist/server.cjs"]
