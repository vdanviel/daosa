FROM node:latest

WORKDIR /app

COPY ./package*.json .

RUN apt-get update && apt-get install -y poppler-utils

RUN npm install

COPY . .

CMD ["npm", "run", "dev"]