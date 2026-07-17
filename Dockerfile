# Production-ready runner stage
# node_modules are NOT copied — npm ci runs natively inside the container
# on whatever arch this image is being built for.
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install openssl for DB connectivity
RUN apk add --no-cache openssl

# Install production dependencies natively for this architecture
COPY package*.json ./
RUN npm ci --omit=dev

# Copy pre-compiled Next.js build assets (built on the matching-arch runner)
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
