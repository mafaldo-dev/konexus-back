FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN rm -f .env

ENV NODE_ENV=production

EXPOSE 3010

CMD ["node", "server/main.js"]
