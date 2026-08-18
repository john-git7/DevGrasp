# ─────────────────────────────────────────────────────────────
# Stage 1: Builder — install ALL deps (including devDependencies)
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first to leverage Docker layer caching.
# If package.json doesn't change, npm install won't re-run.
COPY package.json package-lock.json ./

RUN npm ci

# Copy source after installing deps
COPY . .

# ─────────────────────────────────────────────────────────────
# Stage 2: Production image — only production deps + source
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy only production node_modules from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app .

# Switch to non-root user
USER appuser

# Expose the port Express listens on (matches PORT in .env)
EXPOSE 5001

# Health check — Docker will mark the container unhealthy if this fails
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5001/api/health || exit 1

# Start the server
CMD ["node", "index.js"]
