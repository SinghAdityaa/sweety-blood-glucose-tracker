FROM node:24-alpine AS build
WORKDIR /app
COPY package.json ./package.json
COPY client/package.json ./client/package.json
RUN npm install --workspace client --workspace-root
COPY client ./client
WORKDIR /app/client
RUN npm run build

FROM nginx:1.29-alpine
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 80
