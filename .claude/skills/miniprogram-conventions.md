# miniprogram-conventions

微信小程序原生开发规范。适用于 `miniprogram/` 下的页面、组件开发。

## 一、页面结构

- 每个页面 4 个文件：`页面名.wxml`（模板）、`页面名.wxss`（样式）、`页面名.js`（逻辑）、`页面名.json`（配置）
- `.js` 文件使用 `Page({...})` 或 `Component({...})` 定义
- 组件放在 `components/` 下，每个组件同样 4 个文件
- 全局样式和配置放在 `app.wxss` / `app.json` / `app.js`

## 二、云函数调用

### 2.1 调用方式
```javascript
const res = await wx.cloud.callFunction({ name: "functionName", data: { ... } });
```

### 2.2 返回格式兼容处理（过渡期）
云函数当前存在三套返回格式，调用时必须兼容：
```javascript
const result = res.result || {};
// 先检查 success 字段
if (result.success !== undefined) {
  // Convention A: { success, data?, error? }
  if (result.success) { /* 成功 */ } else { /* 失败: result.error */ }
} else if (result.code !== undefined) {
  // Convention B: { code: 0/-1, message }
  if (result.code === 0) { /* 成功 */ } else { /* 失败: result.message */ }
} else {
  // Convention C: { success, message }
  // 同 A
}
```
新开发的云函数严格使用 Convention A，旧函数修改时同步迁移。

### 2.3 错误提示
```javascript
// 业务错误 — 轻量提示
wx.showToast({ title: "操作失败", icon: "none" });
// 网络异常 — 引导重试
wx.showModal({ title: "网络异常", content: "请检查网络后重试", confirmText: "重试" });
```

## 三、隐私数据展示红线 🔴

### 3.1 WXML 模板层脱敏
使用 `utils/privacy.wxs` 过滤器：
```xml
<wxs module="privacy" src="../../utils/privacy.wxs"></wxs>
<text>{{privacy.maskPhone(phone)}}</text>
<text>{{privacy.maskIdCard(idCard)}}</text>
```

### 3.2 JS 逻辑层脱敏
手机号：`phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')`
身份证号：`idCard.replace(/(\d{4})\d{10}(\d{4})/, '$1**********$2')`

**禁止**在 WXML 中直接渲染原始手机号/身份证号。

## 四、权限控制

- 使用 `app.js` 中的 `app.requirePermission(action)` 检查用户绑定状态
- 敏感操作（开门、提交认证、修改绑定）需额外调用云函数验证权限
- 游客模式（`bindingStatus === "guest"`）的功能受限，在页面 `onLoad` 时检查

## 五、小程序 API 规范

- `wx.getStorageSync` / `wx.setStorageSync` — 仅用于非敏感数据
- **禁止**在 Storage 中存储 token、密码、手机号
- 需要手机号时使用 `wx.getPhoneNumber` + 云函数 `getPhoneNumber` 解密
- 需要登录态时通过 `wx.cloud.callFunction({ name: "wxContext" })` 获取 openid

## 六、禁止事项

- 禁止在 WXML 中写复杂逻辑（用 WXS 封装）
- 禁止在 `onLoad` / `onShow` 等生命周期中不处理异步错误
- 禁止超过 10 个 `wx.cloud.callFunction` 并发调用（小程序限制）
- 禁止在循环中调用云函数（N+1 问题）
- 禁止使用废弃的 wx API（如 `wx.getUserInfo` 直接获取用户信息）
