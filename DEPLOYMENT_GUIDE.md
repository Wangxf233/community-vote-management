# 社区投票管理系统部署指南

## 📋 部署清单

- [ ] 1. 云开发环境配置
- [ ] 2. 云函数部署
- [ ] 3. 数据库初始化
- [ ] 4. 管理后台 API 部署
- [ ] 5. 管理后台前端部署
- [ ] 6. 小程序配置与发布

---

## 一、云开发环境配置

### 1.1 开通云开发

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入小程序管理后台
3. 点击 **开发 → 云开发**
4. 开通云开发服务（选择合适的套餐）
5. 创建一个环境（如：`prod-xxxx`）

### 1.2 获取环境信息

在云开发控制台 → 设置 → 环境设置中获取：

- **环境 ID**（env-id）：如 `cloud1-xxx`
- **环境名称**：如 `生产环境`

### 1.3 配置服务端 API 密钥（用于管理后台）

在云开发控制台 → 设置 → 权限设置 → API 密钥中：

1. 创建密钥（用于服务端调用云开发）
2. 记录 **SecretId** 和 **SecretKey**

---

## 二、云函数部署

### 2.1 在微信开发者工具中部署

1. **打开项目**

   ```
   用微信开发者工具打开 community-vote-management 项目
   ```

2. **选择云开发环境**

   - 点击工具栏的"云开发"图标
   - 选择你的生产环境

3. **批量部署云函数**

   在 `cloudfunctions` 目录上右键，选择"上传并部署：云端安装依赖"

   或者逐个部署核心云函数（优先部署以下）：

   ```
   核心云函数清单（共 50+ 个）：

   ✅ 用户认证类
   - wechatLogin          # 微信登录
   - validateToken        # 验证token
   - getPhoneNumber       # 获取手机号

   ✅ 社区管理类
   - checkCommunity       # 检查社区
   - getUserCommunities   # 获取用户社区列表

   ✅ 房屋绑定类
   - submitBinding        # 提交绑定申请
   - getBindingInfo       # 获取绑定信息
   - getMyHouses          # 获取我的房屋

   ✅ 投票管理类
   - listVotes            # 投票列表
   - createVote           # 创建投票
   - getVoteDetail        # 投票详情
   - getVoteStatistics    # 投票统计
   - getMyVoteRecords     # 我的投票记录
   - updateVote           # 更新投票状态

   ✅ 公告类
   - listAnnouncements    # 公告列表
   - getAnnouncementDetail # 公告详情
   - markAnnouncementRead  # 标记已读
   - getUnreadAnnouncementCount # 未读数量

   ✅ 报修类
   - submitRepair         # 提交报修
   - getMyRepairs         # 我的报修记录
   - getRepairDetail      # 报修详情
   - updateRepairStatus   # 更新报修状态

   ✅ 评价类
   - submitEvaluation     # 提交评价
   - getMyEvaluations     # 我的评价
   - submitCompanyEvaluation # 公司评价

   ✅ 家庭管理类
   - familyManagement     # 家庭成员管理
   - getFamilyList        # 家庭成员列表

   ✅ 管理员类
   - adminListCommunities # 管理社区列表
   - adminListUsers       # 管理用户列表
   - adminListBindings    # 管理绑定列表
   - adminExportBindingsCSV # 导出绑定CSV

   ... 其他云函数
   ```

4. **设置云函数超时时间**

   对于可能长时间运行的云函数（如导出 CSV），在云开发控制台中：

   - 进入"云函数" → 选择函数 → "函数配置"
   - 将超时时间设置为 60 秒

### 2.2 验证云函数部署

在云开发控制台 → 云函数中：

- 查看所有函数是否部署成功
- 可以手动测试关键云函数（如 `wechatLogin`）

---

## 三、数据库初始化

### 3.1 创建数据库集合

在云开发控制台 → 数据库中，创建以下集合：

```
核心集合清单：

1. users                    # 用户表
2. communities              # 社区表
3. bindings                 # 房屋绑定表
4. votes                    # 投票表
5. vote_records             # 投票记录表
6. announcements            # 公告表
7. announcement_reads       # 公告阅读记录表
8. repairs                  # 报修表
9. evaluations              # 评价表
10. evaluation_cycles       # 评价周期表
11. evaluation_staff        # 评价员工表
12. company_evaluations     # 公司评价表
13. company_evaluation_cycles # 公司评价周期表
14. certifications          # 认证记录表
15. community_admins        # 社区管理员表
```

### 3.2 初始化数据

#### 方法一：使用云函数初始化（推荐）

1. 确保已部署 `initData` 云函数
2. 在云开发控制台 → 云函数 → `initData` → 测试
3. 输入测试参数：
   ```json
   {
     "action": "init"
   }
   ```

#### 方法二：手动导入数据

在云开发控制台 → 数据库 → 各集合中手动添加初始数据。

**示例：创建测试社区**

集合：`communities`

```json
{
  "name": "测试花园小区",
  "region": ["广东省", "深圳市", "南山区"],
  "address": "科技园南区",
  "deleted": false,
  "createdAt": { "$date": "2026-01-01T00:00:00.000Z" }
}
```

### 3.3 设置数据库索引（优化性能）

为以下字段创建索引：

**users 集合**

- `openid` (唯一索引)
- `token` (普通索引)

**bindings 集合**

- `openid` (普通索引)
- `communityName` (普通索引)
- `status` (普通索引)

**votes 集合**

- `communityId` (普通索引)
- `type` (普通索引)
- `status` (普通索引)
- `publishTime` (普通索引)

**vote_records 集合**

- 组合索引：`voteId + openid` (唯一索引)

---

## 四、管理后台 API 部署

管理后台 API 需要部署到一个有公网访问的服务器。

### 4.1 选择部署平台

**推荐方案：**

#### 方案 A：云服务器（腾讯云/阿里云/华为云）

**优点**：完全控制、稳定可靠
**成本**：约 ¥100-300/月

#### 方案 B：Docker 容器（腾讯云 CloudRun / 阿里云 SAE）

**优点**：弹性伸缩、按需计费
**成本**：约 ¥50-200/月

#### 方案 C：Serverless（腾讯云函数 SCF）

**优点**：免运维、按调用计费
**成本**：约 ¥20-100/月

### 4.2 使用云服务器部署（推荐新手）

#### 步骤 1：购买云服务器

1. 购买云服务器（推荐配置：2 核 2G、Ubuntu 20.04）
2. 配置安全组：开放 80、443、3000 端口
3. 获取服务器公网 IP

#### 步骤 2：连接服务器并安装环境

```bash
# SSH 连接服务器
ssh root@你的服务器IP

# 更新系统
apt update && apt upgrade -y

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 验证安装
node -v   # 应显示 v18.x.x
npm -v    # 应显示 9.x.x

# 安装 PM2（进程管理器）
npm install -g pm2

# 安装 Git
apt install -y git
```

#### 步骤 3：部署代码

```bash
# 克隆代码仓库
cd /opt
git clone https://github.com/你的用户名/community-vote-management.git
cd community-vote-management/admin

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
nano .env
```

#### 步骤 4：配置环境变量

编辑 `.env` 文件：

```bash
# 云开发环境 ID
TCB_ENV_ID=cloud1-xxx

# 云开发 API 密钥
TCB_SECRET_ID=你的SecretId
TCB_SECRET_KEY=你的SecretKey

# 服务端口
PORT=3000

# 跨域配置（管理前端域名）
CORS_ORIGIN=https://admin.yourdomain.com
```

#### 步骤 5：启动服务

```bash
# 使用 PM2 启动
pm2 start server.js --name "community-vote-admin"

# 设置开机自启
pm2 startup
pm2 save

# 查看日志
pm2 logs community-vote-admin

# 查看状态
pm2 status
```

#### 步骤 6：配置 Nginx 反向代理（可选）

```bash
# 安装 Nginx
apt install -y nginx

# 创建配置文件
nano /etc/nginx/sites-available/admin-api
```

添加以下配置：

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# 启用配置
ln -s /etc/nginx/sites-available/admin-api /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

#### 步骤 7：配置 SSL 证书（推荐）

```bash
# 安装 Certbot
apt install -y certbot python3-certbot-nginx

# 获取 SSL 证书
certbot --nginx -d api.yourdomain.com
```

### 4.3 验证 API 部署

```bash
# 测试 API 是否正常
curl http://你的服务器IP:3000/api/health

# 或者使用域名
curl https://api.yourdomain.com/api/health
```

---

## 五、管理后台前端部署

### 5.1 构建前端项目

在本地电脑上：

```bash
cd admin-frontend

# 安装依赖
npm install

# 修改 API 地址
# 编辑 src/utils/axios.ts，将 baseURL 改为你的 API 地址
# baseURL: 'https://api.yourdomain.com/api'

# 构建生产版本
npm run build
```

### 5.2 部署到静态托管

#### 方案 A：腾讯云静态网站托管

1. 进入云开发控制台 → 静态网站托管
2. 开通静态托管服务
3. 上传 `dist` 目录下的所有文件
4. 配置自定义域名（可选）

#### 方案 B：使用 Nginx 部署到服务器

```bash
# 将构建产物上传到服务器
scp -r dist/* root@你的服务器IP:/var/www/admin

# 配置 Nginx
nano /etc/nginx/sites-available/admin-frontend
```

添加配置：

```nginx
server {
    listen 80;
    server_name admin.yourdomain.com;

    root /var/www/admin;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
# 启用配置
ln -s /etc/nginx/sites-available/admin-frontend /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# 配置 SSL
certbot --nginx -d admin.yourdomain.com
```

---

## 六、小程序配置与发布

### 6.1 配置服务器域名

在微信公众平台 → 开发 → 开发管理 → 开发设置 → 服务器域名中配置：

**request 合法域名：**

```
https://api.yourdomain.com
```

**uploadFile 合法域名：**

```
https://api.yourdomain.com
```

**downloadFile 合法域名：**

```
https://api.yourdomain.com
```

### 6.2 配置业务域名（如果使用 webview）

在微信公众平台 → 开发 → 开发管理 → 开发设置 → 业务域名中配置：

```
admin.yourdomain.com
```

### 6.3 更新小程序代码中的环境配置

确认小程序代码中的云开发环境 ID 正确：

```javascript
// miniprogram/app.js
wx.cloud.init({
  env: "cloud1-xxx", // 你的生产环境 ID
  traceUser: true,
});
```

### 6.4 上传小程序代码

在微信开发者工具中：

1. **点击工具栏"上传"**
2. **填写版本号和备注**
   - 版本号：1.0.0
   - 项目备注：初始版本
3. **点击上传**

### 6.5 提交审核

1. 登录微信公众平台
2. 进入 **版本管理** → **开发版本**
3. 找到刚上传的版本，点击 **提交审核**
4. 填写审核信息：
   - 选择功能页面路径
   - 填写功能描述
   - 上传演示视频/截图

### 6.6 审核通过后发布

审核通过后，在 **版本管理** → **审核版本** 中点击 **发布** 即可。

---

## 七、部署验证清单

### 7.1 云函数验证

- [ ] 在云开发控制台测试 `wechatLogin` 云函数
- [ ] 在云开发控制台测试 `listVotes` 云函数
- [ ] 查看云函数日志是否有错误

### 7.2 数据库验证

- [ ] 所有集合已创建
- [ ] 索引已配置
- [ ] 有至少一条测试社区数据

### 7.3 API 验证

- [ ] API 服务正常运行（PM2 status 显示 online）
- [ ] 可以访问健康检查接口
- [ ] API 日志无错误

### 7.4 前端验证

- [ ] 管理后台可以正常访问
- [ ] 可以登录管理后台
- [ ] 可以进行基本操作（查看社区列表等）

### 7.5 小程序验证

- [ ] 小程序可以正常打开
- [ ] 可以微信登录
- [ ] 可以选择社区
- [ ] 可以提交绑定申请
- [ ] 可以查看投票列表

---

## 八、监控与维护

### 8.1 日志监控

**云函数日志：**

```
云开发控制台 → 云函数 → 选择函数 → 日志
```

**API 日志：**

```bash
# 查看 PM2 日志
pm2 logs community-vote-admin

# 查看 Nginx 日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### 8.2 性能监控

在云开发控制台查看：

- 数据库读写次数
- 云函数调用次数
- 云存储使用量

### 8.3 备份策略

**数据库备份：**

```
云开发控制台 → 数据库 → 备份与恢复 → 创建备份
建议：每天自动备份
```

**代码备份：**

```bash
# 定期推送到 Git 仓库
git add .
git commit -m "Update"
git push
```

### 8.4 常见问题处理

**问题 1：云函数超时**

- 解决：增加云函数超时时间到 60 秒

**问题 2：数据库连接失败**

- 解决：检查云开发环境 ID 和密钥是否正确

**问题 3：API 服务停止**

- 解决：`pm2 restart community-vote-admin`

**问题 4：小程序网络请求失败**

- 解决：检查服务器域名是否配置、SSL 证书是否有效

---

## 九、成本估算

**基础套餐（支持 1000 用户）：**

| 项目         | 费用           | 说明                   |
| ------------ | -------------- | ---------------------- |
| 云开发基础版 | ¥29.9/月       | 5GB 存储 + 10 万次调用 |
| 云服务器     | ¥88/月         | 2 核 2G，1M 带宽       |
| 域名         | ¥50/年         | .com 域名              |
| SSL 证书     | 免费           | Let's Encrypt          |
| **总计**     | **约 ¥118/月** |                        |

---

## 十、技术支持

如遇到部署问题，可以：

1. 查看项目 README.md
2. 查看云开发文档：https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html
3. 查看项目 issues
4. 提交新的 issue

---

## 附录：快速命令参考

### PM2 常用命令

```bash
pm2 start server.js --name app-name    # 启动应用
pm2 stop app-name                       # 停止应用
pm2 restart app-name                    # 重启应用
pm2 delete app-name                     # 删除应用
pm2 logs app-name                       # 查看日志
pm2 status                              # 查看状态
pm2 monit                               # 监控
```

### Nginx 常用命令

```bash
nginx -t                                # 测试配置
systemctl start nginx                   # 启动
systemctl stop nginx                    # 停止
systemctl restart nginx                 # 重启
systemctl reload nginx                  # 重新加载配置
systemctl status nginx                  # 查看状态
```

### Git 常用命令

```bash
git pull                                # 拉取最新代码
git status                              # 查看状态
git add .                               # 添加所有更改
git commit -m "message"                 # 提交
git push                                # 推送
```

---

**部署完成后，记得更新项目 README.md 中的访问地址！**

祝部署顺利！🚀
