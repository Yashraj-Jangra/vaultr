# Production-ready runner stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install openssl for DB connectivity
RUN apk add --no-cache openssl

# Copy package config
COPY package*.json ./

# Install only production dependencies natively on the target architecture
RUN npm ci --omit=dev

# Copy pre-compiled Next.js build assets
COPY .next ./.next
COPY public ./public

# Copy migration files and scripts
COPY drizzle ./drizzle
COPY drizzle.config.ts ./drizzle.config.ts
COPY tsconfig.json ./tsconfig.json
COPY scripts ./scripts

EXPOSE 3000
ENV PORT=3000

# Run database migrations on container startup, then start the web server
CMD node scripts/migrate-production.js && npm run start
