# 社区物业服务系统 — Admin 后端 Dockerfile
# 部署到腾讯云 Cloud Run / 任意 Docker 环境
FROM node:18-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装生产依赖
RUN npm ci --omit=dev --no-optional

# 复制应用代码（.dockerignore 已排除 node_modules / .env / 日志等）
COPY . .

# 端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"]
