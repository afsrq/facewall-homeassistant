FROM node:22-alpine
WORKDIR /app
COPY package.json /app/package.json
COPY server /app/server
COPY www /app/www
ENV NODE_ENV=production PORT=8099
EXPOSE 8099
CMD ["node", "/app/server/server.js"]
