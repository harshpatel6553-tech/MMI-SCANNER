FROM node:22-slim

WORKDIR /usr/src/app

# Copy package files from the server directory
COPY server/package*.json ./

# Prevent Puppeteer from downloading Chromium during build
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install dependencies
RUN npm install

# Copy server source code
COPY server/ ./

# Build the TypeScript project
RUN npm run build

# Expose port
EXPOSE 5000

ENV PORT=5000

# Start the application
CMD [ "npm", "start" ]
