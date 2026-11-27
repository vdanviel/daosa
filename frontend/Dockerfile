FROM node:20-slim

WORKDIR /app

COPY package.json ./
COPY package-lock.json* ./
RUN npm install

EXPOSE 3002
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3002"]
