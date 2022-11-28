FROM node:14-alpine

WORKDIR /app

COPY . .

RUN apk add --no-cache git

RUN npm cache clean --force

RUN npm ci

RUN npx nx run electro-bot:build:production

RUN chmod +x migrate-and-launch.sh

CMD ["sh", "migrate-and-launch.sh"]
