# 社区物业服务系统 — Admin 后端 Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev --no-optional

COPY . .

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"]
