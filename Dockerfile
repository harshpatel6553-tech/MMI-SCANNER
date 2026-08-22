FROM node:20-slim

# Install latest chrome dev package and fonts to support major charsets
RUN apt-get update \
    && apt-get install -y wget gnupg python3 python3-pip python3-pandas \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy package files from the server directory
COPY server/package*.json ./

# Prevent Puppeteer from downloading Chromium during build
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install dependencies
RUN npm ci

# Copy server source code
COPY server/ ./

# Build the TypeScript project
RUN npm run build

# Expose port
EXPOSE 5000

# Set environment variables for Puppeteer to use the installed Chrome
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV PORT=5000

# Start the application
CMD [ "npm", "start" ]
