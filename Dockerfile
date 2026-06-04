# ============================================
# BUILD STAGE
# ============================================
FROM node:20-alpine AS builder

# Set working directory for the server
WORKDIR /app/server

# Copy package configuration files
COPY server/package*.json ./

# Install all dependencies (including TypeScript devDependencies)
RUN npm ci

# Copy the server source code
COPY server/ ./

# Build the TypeScript code to JavaScript (output will be in server/dist)
RUN npm run build

# ============================================
# RUN STAGE
# ============================================
FROM node:20-alpine AS runner

# Set working directory
WORKDIR /app/server

# Copy package files
COPY server/package*.json ./

# Install only production dependencies (saves memory and disk space)
RUN npm ci --omit=dev

# Copy compiled JavaScript files from the builder stage
COPY --from=builder /app/server/dist ./dist

# Set environment
ENV NODE_ENV=production

# Render automatically exposes PORT, but we default to 10000
ENV PORT=10000
EXPOSE 10000

# Start the server
CMD ["node", "dist/index.js"]
