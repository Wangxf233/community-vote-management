# 社区物业服务系统 — Admin 后端 Dockerfile
# 构建：在项目根目录执行
#   docker build -f admin/Dockerfile -t community-admin .
FROM node:18-alpine

WORKDIR /app

# 复制 shared 模块（admin 代码依赖 ../../shared/）
COPY shared/ ./shared/

# 复制 admin 依赖文件
COPY admin/package*.json ./admin/

# 安装生产依赖
RUN cd admin && npm ci --omit=dev --no-optional

# 复制 admin 应用代码
COPY admin/ ./admin/

# 工作目录设为 admin
WORKDIR /app/admin

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"]
