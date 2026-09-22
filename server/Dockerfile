FROM node:22-slim

WORKDIR /usr/src/app

COPY package*.json ./

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN npm install

COPY . .

RUN npm run build

EXPOSE 5000

ENV PORT=5000

CMD [ "npm", "start" ]
