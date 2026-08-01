# commit-git-conventions

Git 分支管理、Commit 提交规范和 PR 审查规范。

## 一、分支策略

| 分支 | 用途 | 保护 |
|------|------|------|
| `main` | 生产就绪分支 | ✅ 受保护 |
| `develop` | 集成分支 | 建议保护 |
| `feature/<功能名>` | 新功能开发 | 否 |
| `fix/<问题描述>` | 缺陷修复 | 否 |
| `refactor/<模块名>` | 重构 | 否 |
| `hotfix/<问题描述>` | 紧急修复（从 main 切出） | 否 |
| `chore/<描述>` | 工程化/配置变更 | 否 |

命名规范：小写 + 短横线连接，如 `feature/announcement-batch-delete`、`fix/phone-display-masking`。

## 二、Commit 规范（Conventional Commits）

### 2.1 格式
```
<type>(<scope>): <subject>
```

### 2.2 type 枚举

| type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 缺陷修复 |
| `refactor` | 重构（不改变功能） |
| `docs` | 文档变更 |
| `style` | 代码格式（不影响逻辑） |
| `test` | 新增/修改测试 |
| `chore` | 工程化/构建/依赖 |
| `perf` | 性能优化 |
| `ci` | CI/CD 变更 |

### 2.3 scope 枚举

| scope | 涉及目录 |
|-------|---------|
| `admin` | Express 后端 |
| `frontend` | Vue 管理前端 |
| `miniprogram` | 微信小程序 |
| `cloudfunction` | 云函数 |
| `shared` | 共享类型/工具 |

### 2.4 示例
```
feat(admin): 添加报修状态批量更新接口
fix(frontend): 修复业主列表手机号脱敏显示问题
refactor(cloudfunction): 统一 createVote 返回格式为 success/error
test(admin): 添加 certification 路由测试
chore: 安装 ESLint 和 Prettier
```

## 三、禁止提交的文件

以下文件/内容禁止 commit：
- `.env` / `.env.local` / `.env.*.local` — 含密钥的环境变量文件
- `node_modules/`
- `dist/` / `build/`
- `.DS_Store` / `Thumbs.db`
- IDE 配置目录（`.vscode/`、`.idea/`）
- 含**明文 token/密码/密钥**的测试脚本或配置文件
- 含 `console.log(手机号)` 或 `console.log(身份证号)` 等隐私数据日志的代码

## 四、敏感文件拦截

pre-commit hook 会扫描暂存区中的文件，拦截包含以下模式的行：
```
password\s*[:=]\s*["'][^"']{8,}["']
secret\s*[:=]\s*["'][^"']{8,}["']
token\s*[:=]\s*["'][^"']{8,}["']
key\s*[:=]\s*["'][^"']{8,}["']
```

> 测试用的假 token/password（如 `testtoken123`、`SuperPass123`）需在文件顶部添加 `// TEST-DATA: contains non-production credentials` 注释来豁免扫描。

## 五、PR 规范

### 5.1 标题
遵循 commit 规范，如 `feat(frontend): 投票管理批量删除功能`

### 5.2 描述模板
```markdown
## 变更说明
简述做了什么改动。

## 测试方式
- [ ] 手动测试步骤
- [ ] 自动化测试结果

## 截图（前端变更时必填）
（粘贴截图）

## 审查检查清单
- [ ] 所有数据库查询过滤了 communityId
- [ ] 前端展示做了隐私数据脱敏
- [ ] 错误响应无内部信息泄露
- [ ] 输入参数有 schema 校验
- [ ] 云函数返回格式为 {success, error}
```

### 5.3 合并要求
- 至少一人 review 通过后方可合入
- 不可合入包含 `errorDetail`、`console.log(隐私数据)` 等应清理的调试代码
- CI 检查（lint + typecheck + build）必须通过

## 六、常见场景的 Commit 拆分

```
场景：新增投票批量删除功能（涉及后端接口 + 前端页面）

commit 1: feat(admin): 添加投票批量删除接口 POST /api/votes/batch-delete
commit 2: feat(frontend): 投票管理页面新增批量勾选和删除功能
commit 3: test(admin): 添加投票批量删除接口测试
commit 4: test(frontend): 添加投票管理批量删除交互测试
```

> 一个 commit 只做一件事。不要把后端改动和前端改动放在同一个 commit 中。
