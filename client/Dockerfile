# ─────────────────────────────────────────────────────────────
# Stage 1: Builder — install deps and build the Vite bundle
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build the production bundle into /app/dist
RUN npm run build

# ─────────────────────────────────────────────────────────────
# Stage 2: Serve static files with Nginx (tiny, fast, secure)
# ─────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS production

# Remove default Nginx site config
RUN rm /etc/nginx/conf.d/default.conf

# Copy the custom Nginx config that handles React Router (client-side routing)
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copy the Vite build output from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Nginx runs in the foreground
CMD ["nginx", "-g", "daemon off;"]
