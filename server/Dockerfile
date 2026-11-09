FROM node:24-alpine
WORKDIR /app
COPY package.json ./package.json
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm install --omit=dev --workspace server --workspace-root
COPY server ./server
WORKDIR /app/server
EXPOSE 4000
CMD ["node", "src/index.js"]
