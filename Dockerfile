# ============================================
# BUILD STAGE
# ============================================
FROM node:22-bookworm-slim AS builder

# Set working directory for the server
WORKDIR /app/server

# Copy package configuration files
COPY server/package*.json ./

# Install all dependencies (including TypeScript devDependencies)
RUN npm install

# Copy the server source code
COPY server/ ./

# Build the TypeScript code to JavaScript (output will be in server/dist)
RUN npm run build

# ============================================
# RUN STAGE
# ============================================
FROM node:22-bookworm-slim AS runner

# Install Python 3, pip, and pandas (needed for NSE bulk deal scraper)
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-pandas --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app/server

# Copy package files
COPY server/package*.json ./

# Install only production dependencies (saves memory and disk space)
RUN npm install --omit=dev

# Copy compiled JavaScript files from the builder stage
COPY --from=builder /app/server/dist ./dist

# Also copy the Python scripts so they are available in production
COPY --from=builder /app/server/src/scripts ./src/scripts

# Set environment
ENV NODE_ENV=production

# Render automatically exposes PORT, but we default to 10000
ENV PORT=10000
EXPOSE 10000

# Start the server
CMD ["node", "dist/index.js"]
