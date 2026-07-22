# cloudfunction-conventions

微信云函数专属全流程规范。适用于 `cloudfunctions/` 下的云函数编写和修改。

> ⚠️ 云函数使用 `wx-server-sdk`，与 Express 后端的 `@cloudbase/node-sdk` 是完全不同的 SDK。禁止在此场景套用 Express 规范。

## 一、初始化（统一模板）

### 1.1 标准初始化（所有函数必须遵循）
```javascript
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  // 1. 参数校验
  // 2. 业务逻辑
  // 3. 返回结果
};
```

### 1.2 禁止的初始化方式
```javascript
// ❌ 无参 init — 需要手动配置 env
cloud.init();
// ❌ 硬编码 env ID — 不同环境无法复用
cloud.init({ env: "cloud1-6ghienoi526fff51" });
// ❌ 使用 process.env.TCB_ENV — 云函数环境变量不可靠
cloud.init({ env: process.env.TCB_ENV });
```

### 1.3 SDK 版本
- `wx-server-sdk` 统一使用 `^3.0.1`
- `package.json` 中 `dependencies` 仅列出实际使用的包，禁止包含未使用的依赖

## 二、入参校验（函数体第一段）

```javascript
exports.main = async (event, context) => {
  // === 第一段：参数校验 ===
  const { communityId, type, title } = event;

  if (!communityId || !type || !title) {
    return {
      success: false,
      error: "communityId, type and title are required"
    };
  }

  // 手机号格式校验
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (phone && !phoneRegex.test(phone)) {
    return { success: false, error: "手机号格式不正确" };
  }

  // === 第二段：业务逻辑 ===
  // ...
};
```

## 三、返回格式（全项目强制统一）🔴

### 3.1 标准格式（所有新函数必须使用）
```javascript
// 成功
return { success: true };
return { success: true, data: { ... } };
return { success: true, data: [...], total: 100 };

// 失败
return { success: false, error: "用户友好的错误描述" };
```

### 3.2 禁止的返回格式
```javascript
// ❌ 旧 Convention B — 逐步迁移
return { code: 0, message: "成功" };
return { code: -1, message: "失败" };

// ❌ 旧 Convention C
return { success: true, message: "成功" };

// ❌ 信息泄露
return { success: false, error: err.message, errorDetail: JSON.stringify(err) };
return { success: false, error: err.message || String(err) };

// ❌ 调试字段
return { success: true, data: { ... }, rawData: ocrResult };
```

### 3.3 迁移规则
修改已有云函数时，若其返回格式非 `{success, error}` 标准，**必须同步迁移**。

## 四、数据库操作

### 4.1 写操作（统一 {data} 包装）
```javascript
// ✅ 正确
await db.collection("votes").add({ data: newVote });
await db.collection("votes").doc(id).update({ data: updates });

// ❌ 错误 — 云函数 wx-server-sdk 不支持无 {data} 包装
await db.collection("votes").add(newVote);
```

### 4.2 查询限制
- 单次 `.get()` 默认最多返回 **100 条**，需配合 `.skip()` / `.limit()` 分页
- `.count()` 上限 **1000**，大数据量用聚合 `$group` + `$sum`
- 聚合查询 `.aggregate()` 限制 **20 次/秒**

### 4.3 批量与事务
- 批量写入每次 ≤ 100 条
- 原子操作使用 `db.startTransaction()`
- 禁止在循环中查询数据库（改用 `db.command.in()` 批量查询）

## 五、权限与身份

- **小程序调用**：通过 `cloud.getWXContext().OPENID` 获取用户身份
- **Admin 端调用**：接收 `event.adminToken`，信任调用方已验证（`server.js` 的 `authMiddleware` 已校验）
- **定时触发器调用**：无用户上下文，通过 `config.json` 中 `triggers` 配置触发
- 禁止在云函数代码中硬编码 token、密码、密钥

## 六、日志规范

```javascript
// ✅ 正确 — 分级日志
console.log("操作描述", { id, timestamp });       // 正常流程
console.warn("可恢复异常", { reason });            // 可恢复
console.error("严重错误", { code: err.code });     // 需要关注

// ✅ 正确 — 隐私数据脱敏后再打印
console.log("用户操作", { phone: phone.slice(0,3) + '****' + phone.slice(7) });

// ❌ 禁止 — 直接打印隐私数据
console.log("用户手机号:", phone);      // 手机号明文
console.log("身份证号:", idCard);       // 身份证号明文
console.log("完整地址:", fullAddress);  // 详细地址明文
```

## 七、定时触发器

`config.json` 标准格式：
```json
{
  "triggers": [{
    "name": "myTrigger",
    "type": "timer",
    "config": "0 0 2 * * * *"
  }]
}
```
时间格式：`秒 分 时 日 月 周 年`（7 位 cron）

## 八、目录结构

```
cloudfunctions/
├── common/                  # 共享工具函数（待创建）
│   ├── privacy.js           #   脱敏工具
│   └── ...
├── functionName/
│   ├── index.js             # 入口（exports.main）
│   ├── package.json         # 依赖（wx-server-sdk ^3.0.1）
│   ├── config.json          # 触发器配置（可选）
│   └── __tests__/           # 测试（Stage 1 后）
│       └── index.test.js
```

## 九、禁止事项

- 禁止在云函数内再次调用其他云函数形成递归链
- 禁止在循环内做数据库查询（N+1 问题）
- 禁止复制粘贴工具函数 — 统一抽取到 `cloudfunctions/common/`
- 禁止使用 `event` 中未经校验的参数直接构造数据库查询
- 禁止在云函数中超过 20 秒执行（微信超时限制）
- 禁止返回超过 6MB 的响应体
