FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json server.js ./
USER node
# Cloud Run은 PORT 환경변수(기본 8080)를 주입하며 server.js가 이를 읽는다
CMD ["node", "server.js"]
