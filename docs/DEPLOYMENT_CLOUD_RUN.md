# 管理后台 API 部署 - 云托管方案（无需购买服务器）

## 方案说明

使用微信云开发的**云托管**服务部署管理后台 API，无需购买云服务器。

## 前置条件

- ✅ 已开通小程序云开发环境
- ✅ 实名认证的腾讯云账号

---

## 一、准备工作

### 1. 为管理后台 API 创建 Dockerfile

在 `admin` 目录下创建 `Dockerfile`：

```dockerfile
# 使用 Node.js 18 官方镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖（生产环境）
RUN npm ci --only=production

# 复制所有文件
COPY . .

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["node", "server.js"]
```

### 2. 创建 .dockerignore 文件

在 `admin` 目录下创建 `.dockerignore`：

```
node_modules
npm-debug.log
.env
.git
.gitignore
README.md
```

### 3. 修改环境变量读取方式

确保 `admin/config/db.js` 能正确读取环境变量：

```javascript
// admin/config/db.js 实际内容（勿修改，仅供参考）
const cloudbase = require("@cloudbase/node-sdk");
require("dotenv").config();

const ENV_ID = process.env.TCB_ENV_ID; // 对应云托管环境变量 TCB_ENV_ID
const SECRET_ID = process.env.TCB_SECRET_ID; // 对应 TCB_SECRET_ID
const SECRET_KEY = process.env.TCB_SECRET_KEY;

if (!ENV_ID || !SECRET_ID || !SECRET_KEY) {
  console.warn("Warning: TCB env vars not set. See admin/.env.example");
}

const tcb = cloudbase.init({
  env: ENV_ID,
  secretId: SECRET_ID,
  secretKey: SECRET_KEY,
});
const db = tcb.database();
module.exports = { tcb, db };
```

---

## 二、开通云托管服务

### 1. 进入云托管控制台

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入小程序管理后台
3. 点击 **开发 → 云开发 → 云托管**
4. 如果是首次使用，点击 **开通**

### 2. 创建服务

1. 点击 **新建服务**
2. 填写服务信息：
   - **服务名称**：`admin-api`
   - **备注**：管理后台 API 服务
3. 点击 **确定**

### 3. 配置环境变量

在服务详情页 → **版本管理** → **环境变量**中添加：

| 变量名           | 值             | 说明          |
| ---------------- | -------------- | ------------- |
| `TCB_ENV_ID`     | 你的环境 ID    | 云开发环境 ID |
| `TCB_SECRET_ID`  | 你的 SecretId  | 云开发密钥    |
| `TCB_SECRET_KEY` | 你的 SecretKey | 云开发密钥    |
| `PORT`           | `3000`         | 服务端口      |
| `NODE_ENV`       | `production`   | 生产环境      |

---

## 三、部署代码

### 方式一：使用微信开发者工具部署（推荐）

1. **打开微信开发者工具**
2. **点击工具栏"云开发"**
3. **进入"云托管"标签**
4. **选择服务**：`admin-api`
5. **点击"新建版本"**：
   - 版本名称：`v1.0.0`
   - 上传方式：选择"本地代码包"
   - 代码路径：选择 `admin` 目录
   - 端口：`3000`
   - 资源配置：
     - CPU：0.25 核
     - 内存：0.5 GB
     - 实例数：1-2（自动扩缩容）
6. **点击"部署"**

### 方式二：使用命令行部署

```bash
# 1. 安装 CloudBase CLI
npm install -g @cloudbase/cli

# 2. 登录
tcb login

# 3. 进入 admin 目录
cd admin

# 4. 初始化云托管配置
tcb run init

# 5. 部署
tcb run deploy --service admin-api
```

### 方式三：使用 Docker 本地构建后推送

```bash
# 1. 构建 Docker 镜像
cd admin
docker build -t admin-api:v1.0.0 .

# 2. 标记镜像
docker tag admin-api:v1.0.0 ccr.ccs.tencentyun.com/你的命名空间/admin-api:v1.0.0

# 3. 推送到腾讯云容器镜像服务
docker push ccr.ccs.tencentyun.com/你的命名空间/admin-api:v1.0.0

# 4. 在云托管控制台选择该镜像部署
```

---

## 四、配置访问路径

### 1. 获取默认域名

部署成功后，在云托管控制台 → 服务详情中可以看到：

**默认域名**：`https://admin-api-xxx.service.tcloudbase.com`

### 2. 配置自定义域名（可选）

1. 在云托管控制台 → **服务设置** → **域名管理**
2. 点击 **添加域名**
3. 填写你的域名（如 `api.yourdomain.com`）
4. 完成域名解析（添加 CNAME 记录）
5. 系统会自动配置 SSL 证书

### 3. 测试 API

```bash
# 测试默认域名
curl https://admin-api-xxx.service.tcloudbase.com/api/communities

# 测试自定义域名
curl https://api.yourdomain.com/api/communities
```

---

## 五、配置小程序服务器域名

在微信公众平台 → 开发 → 开发管理 → 开发设置 → **服务器域名**中添加：

**request 合法域名：**

```
https://admin-api-xxx.service.tcloudbase.com
```

或者使用自定义域名：

```
https://api.yourdomain.com
```

---

## 六、更新管理前端配置

修改 `admin-frontend/src/utils/axios.ts`：

```typescript
import axios from "axios";

const instance = axios.create({
  // 使用云托管域名
  baseURL: "https://admin-api-xxx.service.tcloudbase.com/api",
  // 或使用自定义域名
  // baseURL: 'https://api.yourdomain.com/api',
  timeout: 10000,
});

// ... 其他配置
```

---

## 七、监控与日志

### 查看服务状态

云托管控制台 → 服务详情：

- 实例数量
- CPU/内存使用率
- 请求量统计

### 查看日志

云托管控制台 → **日志** 标签：

- 实时日志流
- 历史日志查询
- 错误日志告警

### 配置告警

云托管控制台 → **告警配置**：

- CPU 使用率 > 80%
- 内存使用率 > 80%
- 请求错误率 > 5%

---

## 八、扩缩容配置

### 自动扩缩容规则

在服务配置中设置：

- **最小实例数**：1（保证服务不中断）
- **最大实例数**：5（控制成本）
- **扩容触发条件**：
  - CPU 使用率 > 70%
  - 内存使用率 > 70%
- **缩容触发条件**：
  - CPU 使用率 < 30% 持续 5 分钟

---

## 九、成本估算

### 云托管计费说明

**按量计费**（推荐新手）：

- CPU：¥0.055/核/小时
- 内存：¥0.032/GB/小时
- 免费额度：每月 1000 vCPU·s + 2000 GiB·s

**包年包月**（推荐生产环境）：

- 0.25 核 0.5G：¥28/月
- 0.5 核 1G：¥54/月
- 1 核 2G：¥108/月

### 月成本估算

**小型应用（1000 用户）**：

- 云托管（0.25 核 0.5G）：¥28/月
- 云开发基础版：¥29.9/月
- **总计：约 ¥58/月**

比购买云服务器便宜约 **50%**！

---

## 十、常见问题

### Q1：部署失败，提示端口不匹配？

**A**：确保 Dockerfile 中 EXPOSE 的端口与服务配置中的端口一致（默认 3000）。

### Q2：环境变量读取不到？

**A**：检查云托管控制台中环境变量是否正确配置，注意变量名大小写。

### Q3：访问 API 返回 502？

**A**：查看日志，可能是应用启动失败或端口监听错误。

### Q4：如何回滚到上一个版本？

**A**：在云托管控制台 → 版本管理中，选择历史版本点击"切换"。

### Q5：如何更新代码？

**A**：重新部署新版本即可，支持灰度发布（流量逐步切换）。

---

## 十一、与云服务器方案对比

| 对比项         | 云托管      | 云服务器      |
| -------------- | ----------- | ------------- |
| **购买服务器** | ❌ 不需要   | ✅ 需要       |
| **运维难度**   | ⭐ 简单     | ⭐⭐⭐⭐ 复杂 |
| **自动扩容**   | ✅ 支持     | ❌ 需手动     |
| **成本**       | ¥28-108/月  | ¥88-300/月    |
| **高可用**     | ✅ 自动容灾 | ❌ 需自行配置 |
| **HTTPS**      | ✅ 自动配置 | ❌ 需手动配置 |
| **监控告警**   | ✅ 内置     | ❌ 需自行搭建 |
| **适用场景**   | 小中型应用  | 大型应用      |

**结论**：对于社区投票管理系统，强烈推荐使用**云托管方案**！

---

## 十二、部署验证清单

部署完成后，验证以下项目：

- [ ] 云托管服务状态为"运行中"
- [ ] 实例数量 ≥ 1
- [ ] 可以通过默认域名访问 API
- [ ] 日志中无错误信息
- [ ] 环境变量配置正确
- [ ] 管理前端可以正常调用 API
- [ ] 小程序服务器域名已配置

---

## 附录：快速命令参考

### CloudBase CLI 常用命令

```bash
# 登录
tcb login

# 查看服务列表
tcb run service:list

# 查看版本列表
tcb run version:list --service admin-api

# 部署新版本
tcb run deploy --service admin-api

# 查看日志
tcb run logs --service admin-api

# 查看服务详情
tcb run service:describe --service admin-api
```

---

**使用云托管，让部署更简单！**🚀
