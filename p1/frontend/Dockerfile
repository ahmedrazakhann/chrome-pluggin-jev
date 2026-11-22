FROM node:22.12.0-bullseye-slim AS base


# -------------------------------
# All dependencies (dev + prod)
# -------------------------------
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
#install command
RUN npm ci 


# -------------------------------
# Production-only dependencies
# -------------------------------
FROM base AS production-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts


# -------------------------------
# Build stage
# -------------------------------
FROM base AS build
WORKDIR /app

# Use full deps for build
COPY --from=deps /app/node_modules /app/node_modules

# Copy source
COPY . .

# Build Next.js app
RUN npm run build


# -------------------------------
# Production runner
# -------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy production deps (only if needed)
COPY --from=production-deps /app/node_modules /app/node_modules

# Copy Next.js standalone output
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "server.js"]