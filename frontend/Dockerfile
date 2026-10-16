FROM node:20-slim

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3002
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3002"]
