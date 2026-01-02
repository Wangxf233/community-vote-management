# 管理前端部署指南

## 修改内容说明

已将所有页面的 HTTP 请求统一为 axios：

- ✅ 所有 `fetch` 调用已替换为 `request` (axios 实例)
- ✅ 统一了 API 请求方式
- ✅ 自动处理 token 认证
- ✅ 自动处理错误提示
- ✅ 支持开发/生产环境切换

## 部署前配置

### 1. 修改 API 地址

编辑 `src/utils/axios.ts`，将云托管域名改为你的实际域名：

```typescript
baseURL: import.meta.env.PROD
  ? "https://你的云托管域名/api"  // ⚠️ 替换为实际域名
  : "http://localhost:3000/api",
```

查看云托管域名：

1. 登录腾讯云开发控制台
2. 云托管 → 服务列表
3. 找到 `admin-api` 服务
4. 复制访问域名（格式：`https://admin-api-xxx.service.tcloudbase.com`）

### 2. 构建生产版本

```bash
cd admin-frontend
npm install
npm run build
```

构建完成后，`dist` 目录包含所有静态文件。

## 部署方式

### 方式一：静态网站托管（推荐）✅

**优点：**

- 免费额度充足
- 部署简单
- 自动 CDN 加速
- 自带 HTTPS

**步骤：**

1. 打开腾讯云开发控制台
2. 进入"静态网站托管"
3. 点击"文件管理"
4. 上传 `dist` 文件夹内的所有文件
5. 配置完成后，访问提供的域名即可

**路由配置（SPA 应用必须）：**

在静态网站托管设置中，添加错误页面配置：

- 错误码：404
- 重定向到：/index.html
- 状态码：200

这样可以确保前端路由正常工作。

### 方式二：Nginx 部署

如果有自己的服务器，可以用 Nginx：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/admin-frontend/dist;
    index index.html;

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 方式三：云托管部署（不推荐）

虽然可以部署到云托管，但会占用容器资源，成本较高。

## 验证部署

部署完成后测试：

1. 访问管理前端地址
2. 使用测试账号登录
3. 检查 Network 面板，API 请求应该指向云托管域名
4. 测试核心功能：
   - 投票管理
   - 业主管理
   - 认证审核

## 常见问题

### Q1: 登录后提示网络错误

**原因：** axios.ts 中的 API 地址未修改或不正确

**解决：**

1. 检查 `src/utils/axios.ts` 中的 baseURL
2. 确认云托管服务正在运行
3. 在浏览器 Network 面板查看实际请求的 URL

### Q2: 部署后页面刷新 404

**原因：** SPA 应用路由未配置

**解决：**

- 静态托管：配置 404 重定向到 index.html
- Nginx：添加 `try_files` 配置

### Q3: 接口跨域问题

**原因：** 后端未配置 CORS

**解决：**
后端 `admin/server.js` 已配置 CORS，确认以下代码存在：

```javascript
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
```

## 环境变量（可选优化）

为了更灵活的配置，可以使用环境变量：

创建 `.env.production`：

```env
VITE_API_BASE_URL=https://你的云托管域名/api
```

修改 `axios.ts`：

```typescript
baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api",
```

这样不同环境可以用不同的 `.env` 文件。

## 更新部署

当代码有更新时：

```bash
# 1. 构建新版本
npm run build

# 2. 上传 dist 目录
#    - 静态托管：在控制台上传
#    - Nginx：rsync/scp 到服务器
```

## 相关链接

- 后端部署文档：`../admin/DEPLOYMENT_GUIDE.md`
- 腾讯云开发控制台：https://console.cloud.tencent.com/tcb
- 静态网站托管文档：https://cloud.tencent.com/document/product/876/40270
