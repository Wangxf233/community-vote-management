# error-handling

统一错误处理规范。覆盖 Express 后端、Vue 管理前端、微信小程序、云函数四端。

---

## 一、Express 后端

### 1.1 路由 handler
```javascript
router.get("/resource", authMiddleware, async (req, res) => {
  try {
    // 业务逻辑
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error("操作描述:", err.message);  // 不打印完整 err 对象
    return res.status(500).json({
      success: false,
      error: "用户友好描述"
    });
  }
});
```

### 1.2 正确的 HTTP 状态码
- `400` — 参数错误/校验失败 → `"validation_error"` / `"missing_params"`
- `401` — 未认证 → `"token_missing"` / `"token_invalid"`
- `403` — 无权限/到期 → `"insufficient_permissions"` / `"community_expired"`
- `404` — 资源不存在 → `"resource_not_found"`
- `409` — 资源冲突 → `"resource_conflict"`
- `500` — 服务器内部错误 → `"internal_error"`

### 1.3 禁止的写法
```javascript
// ❌ 暴露原始错误 — 可能泄露 SDK 内部信息
res.status(500).json({ success: false, error: e.message || e });

// ❌ 用 200 返回错误
res.status(200).json({ success: false, error: "..." });

// ❌ 缺少 success: false
res.json({ error: "something wrong" });

// ✅ 正确
res.status(500).json({ success: false, error: "服务器内部错误" });
```

### 1.4 全局异常捕获
`server.js` 中已有 `uncaughtException` 和 `unhandledRejection` 处理器，需保持。后续 Stage 2 创建全局错误处理中间件 `admin/middleware/error-handler.js`。

---

## 二、Vue 管理前端

### 2.1 axios 拦截器（已有实现）
`src/utils/axios.ts` 已处理：
- `401` → 自动跳转登录
- `403` + `community_expired` → 传递给调用方处理
- `500` → 全局错误提示
- 网络错误/超时 → 全局提示

**无需在组件中重复处理上述错误。**

### 2.2 组件中的错误处理
```typescript
// 400 错误 — 组件内处理，拦截器不拦截
try {
  await request.post("/api/repairs", formData);
  ElMessage.success("提交成功");
} catch (err: any) {
  if (err.response?.status === 400) {
    ElMessage.error(err.response.data.error || "参数错误");
  } else {
    // 其他错误已被拦截器处理，仅需清理 loading 状态
  }
} finally {
  loading.value = false;
}
```

---

## 三、微信小程序

### 3.1 云函数调用错误处理
```javascript
try {
  const res = await wx.cloud.callFunction({ name: "xxx", data: {} });
  const result = res.result || {};

  // 兼容三套返回格式（过渡期）
  const isSuccess = result.success !== undefined
    ? result.success
    : result.code === 0;

  if (isSuccess) {
    // 处理成功
  } else {
    wx.showToast({
      title: result.error || result.message || "操作失败",
      icon: "none"
    });
  }
} catch (err) {
  // 网络异常或云函数调用失败
  wx.showModal({
    title: "网络异常",
    content: "请检查网络后重试",
    confirmText: "重试",
    success: (modalRes) => {
      if (modalRes.confirm) {
        // 重试逻辑
      }
    }
  });
}
```

### 3.2 禁止的写法
```javascript
// ❌ catch 块为空
try { ... } catch (err) {}

// ❌ 只 console.error 不给用户提示
catch (err) { console.error(err); }
```

---

## 四、云函数

### 4.1 标准模式
```javascript
exports.main = async (event, context) => {
  try {
    // 1. 参数校验 → 返回 { success: false, error: "..." }
    // 2. 业务逻辑
    // 3. 返回 { success: true, data: ... }
  } catch (err) {
    console.error("functionName error:", err.message);
    return {
      success: false,
      error: "用户友好的错误描述"
    };
  }
};
```

### 4.2 禁止的写法
```javascript
// ❌ 信息泄露 — errorDetail 包含完整调用栈
return {
  success: false,
  error: err.message,
  errorDetail: JSON.stringify(err)
};

// ❌ 暴露原始 message
return { success: false, error: err.message || String(err) };

// ❌ 吞异常
try { ... } catch (err) {
  console.error(err);
  // 无 return — 函数返回 undefined，调用方收到奇怪的响应
}

// ✅ 正确
try { ... } catch (err) {
  console.error("functionName error:", err.message);
  return { success: false, error: "操作失败，请稍后重试" };
}
```

### 4.3 批量操作中的错误处理
```javascript
// 单个子操作失败不应阻塞整体
const results = await Promise.allSettled(
  items.map(item => db.collection("xxx").add({ data: item }))
);

const failed = results.filter(r => r.status === "rejected");
if (failed.length > 0) {
  console.warn(`${failed.length}/${items.length} 写入失败`);
}
```

---

## 五、全局红线（四端通用）

| 红线 | 说明 |
|------|------|
| 🚫 空 catch 块 | catch 块必须包含至少一条语句 |
| 🚫 只 console.error 不处理 | 必须返回/提示用户 |
| 🚫 用户可见错误信息暴露内部细节 | 禁止 err.message/err.stack 出现在返回/提示中 |
| 🚫 吞异常后继续执行 | 异常后若无法恢复，必须向上抛出或终止操作 |
