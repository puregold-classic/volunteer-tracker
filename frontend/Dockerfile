# Frontend image used by docker-compose.deploy.yml.
# Multi-stage: vite build with node, serve static dist with nginx.
# VITE_API_BASE_URL is intentionally NOT set — frontend code defaults to "/api"
# which the nginx config below proxies to the backend container (same origin,
# no CORS).

FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runner

# Replace the default site with ours (SPA fallback + /api proxy)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Built static assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
