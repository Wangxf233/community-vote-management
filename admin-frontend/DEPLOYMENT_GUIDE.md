# 管理前端部署指南

## 方式一：自动部署（GitHub 集成）

### 1. 配置静态网站托管

在腾讯云开发控制台：

1. 打开：云开发 → 静态网站托管 → 设置
2. 配置：

   ```
   代码来源：GitHub
   仓库：Wangxf233/community-vote-management
   分支：main

   安装目录：admin-frontend
   安装命令：npm install
   构建命令：npm run build
   输出目录：dist
   ```

### 2. 环境变量配置

需要设置生产环境的 API 地址，在构建配置中添加环境变量：

```bash
NODE_ENV=production
```

## 方式二：本地构建 + 手动上传（推荐）✅

### 1. 本地构建

```bash
cd admin-frontend
npm install
npm run build
```

构建完成后会生成 `dist` 文件夹。

### 2. 上传到静态网站托管

在腾讯云开发控制台：

1. 打开：云开发 → 静态网站托管 → 文件管理
2. 删除现有文件（如果有）
3. 上传 `admin-frontend/dist` 目录下的所有文件
4. 等待上传完成

### 3. 访问地址

静态网站托管会提供一个默认域名，格式：

```
https://[envId].tcloudbaseapp.com
```

也可以绑定自定义域名。

## 重要配置说明

### API 地址配置

在 `admin-frontend/src/utils/axios.ts` 中已配置：

```typescript
baseURL: import.meta.env.PROD
  ? "https://admin-213370-7-1325504194.sh.run.tcloudbase.com/api" // 生产环境：云托管 API
  : "/api"; // 开发环境：Vite proxy
```

**部署前请确认云托管域名正确！**

### 文件结构

上传后的文件结构应该是：

```
/
├── index.html
├── assets/
│   ├── index-xxx.js
│   ├── index-xxx.css
│   └── ...
├── favicon.ico
└── ...
```

**注意：** 不要把整个 dist 文件夹上传，而是上传 dist 里面的内容！

## 故障排查

### 问题 1：页面空白

- 检查浏览器控制台是否有 404 错误
- 确认文件是否正确上传

### 问题 2：API 请求失败

- 检查 axios.ts 中的云托管域名是否正确
- 确认云托管服务是否正常运行
- 检查浏览器控制台的网络请求

### 问题 3：路由 404

静态网站托管需要配置重写规则，将所有请求重定向到 index.html：

在静态网站托管 → 设置 → 路由规则中添加：

```json
[
  {
    "path": "/*",
    "target": "/index.html"
  }
]
```

## 验证部署

1. 访问静态网站托管域名
2. 测试登录功能
3. 检查 API 请求是否正常
4. 测试各个页面功能

## 域名配置（可选）

如果需要自定义域名：

1. 在静态网站托管 → 设置 → 域名管理
2. 添加自定义域名
3. 配置 DNS 解析（CNAME）
4. 等待 SSL 证书自动签发
