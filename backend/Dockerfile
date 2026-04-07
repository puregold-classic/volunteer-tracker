# Backend production-ish image used by docker-compose.deploy.yml
# (Mac mini sandbox + future paid prod). The previous incarnation of this file
# targeted Render.com and is gone — see git history if you need it back.

FROM node:20-alpine

# openssl is required by Prisma's query engine binary on alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Install runtime deps only. Copy package files first for layer caching.
COPY package*.json ./
RUN npm ci --omit=dev

# Generate Prisma client. Schema is copied separately so changes to src/
# below do not bust this layer.
COPY prisma ./prisma
RUN npx prisma generate

# Application code
COPY src ./src

# Drop privileges
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 5000

# Apply pending migrations on every container start, then run the server.
# `migrate deploy` is the production-safe variant — it never prompts and never
# generates new migrations. Idempotent if the DB is already up-to-date.
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
