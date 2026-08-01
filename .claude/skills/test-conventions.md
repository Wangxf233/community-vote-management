# test-conventions

全端统一测试规范。覆盖 Vue 管理前端、Express 后端、云函数、微信小程序四端。

> 当前项目零测试。本规范定义框架、目录结构、Mock 策略和覆盖率目标，让 AI 在写新功能代码时同步生成规范化的测试。

---

## 一、Vue 管理前端测试

### 1.1 技术栈
- 测试框架：**Vitest**
- 组件测试：**@vue/test-utils**
- DOM 环境：**jsdom**
- 配置文件：`admin-frontend/vitest.config.ts`

### 1.2 目录结构
```
admin-frontend/src/
├── __tests__/
│   ├── utils/
│   │   ├── axios.test.ts          # Axios 拦截器测试
│   │   ├── privacy.test.ts        # 脱敏函数测试
│   │   └── formatRoom.test.ts     # 房号格式化测试
│   ├── components/                # 通用组件测试（后续）
│   └── pages/                     # 页面测试（后续）
```

原则：`__tests__/` 镜像 `src/` 结构。

### 1.3 测试类型与示例

**工具函数测试**（优先级最高）：
```typescript
import { describe, it, expect } from 'vitest';
import { maskPhone, maskIdCard } from '@/utils/privacy';

describe('maskPhone', () => {
  it('should mask middle 4 digits', () => {
    expect(maskPhone('13812345678')).toBe('138****5678');
  });
  it('should handle empty string', () => {
    expect(maskPhone('')).toBe('');
  });
});
```

**组件测试**（关键业务组件）：
覆盖：正常渲染、用户交互、错误状态、边界情况。

### 1.4 Mock 策略
- axios 请求：`vi.mock('@/utils/axios')`
- Element Plus 组件：不需要 mock（真实渲染）
- Vue Router：使用 `createRouter` + `createWebHashHistory` 创建测试路由

### 1.5 覆盖率目标
- 工具函数：初期 80%，目标 90%
- 关键业务组件：初期 50%，目标 70%

---

## 二、Express 后端测试

### 2.1 技术栈
- 测试框架：**Jest**
- HTTP 测试：**supertest**
- 配置文件：`admin/jest.config.js`

### 2.2 目录结构
```
admin/
├── __tests__/
│   ├── routes/
│   │   ├── health.test.js         # GET /api/health
│   │   ├── auth.test.js           # 登录认证
│   │   ├── certification.test.js  # 认证审核
│   │   └── repair.test.js         # 报修接口
│   └── middleware/
│       └── auth.test.js           # 认证中间件
```

### 2.3 测试覆盖要求
每个路由至少覆盖：
- ✅ 正常请求 → 200 + `{ success: true }`
- ✅ 未认证 → 401 + `{ error: "token_missing" }`
- ✅ 参数缺失 → 400 + `{ error: "validation_error" }`
- ✅ 越权访问 → 403（如适用）

### 2.4 Mock 策略
```javascript
// Mock CloudBase SDK
jest.mock('../config/db', () => ({
  db: {
    collection: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ data: [] }),
    count: jest.fn().mockResolvedValue({ total: 0 }),
    add: jest.fn().mockResolvedValue({ _id: 'test-id' }),
    doc: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue({ updated: 1 }),
    remove: jest.fn().mockResolvedValue({ deleted: 1 }),
  },
  tcb: {
    callFunction: jest.fn().mockResolvedValue({ result: { success: true } }),
  },
}));
```

### 2.5 覆盖率目标
- 路由：初期 60%，目标 80%

---

## 三、云函数测试

### 3.1 测试方式
本地 Node.js 直接调用 `exports.main(event, context)`。

### 3.2 目录结构
```
cloudfunctions/createVote/
├── index.js
├── package.json
└── __tests__/
    └── index.test.js
```

### 3.3 测试示例
```javascript
const { main } = require('../index');

// Mock wx-server-sdk
jest.mock('wx-server-sdk', () => ({
  init: jest.fn(),
  database: jest.fn(() => ({
    collection: jest.fn().mockReturnThis(),
    add: jest.fn().mockResolvedValue({ _id: 'mock-id' }),
  })),
  DYNAMIC_CURRENT_ENV: Symbol('DYNAMIC_CURRENT_ENV'),
  getWXContext: jest.fn(() => ({ OPENID: 'test-openid' })),
}));

describe('createVote', () => {
  it('should return error when communityId is missing', async () => {
    const result = await main({ title: 'test' }, {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('communityId');
  });

  it('should create vote successfully', async () => {
    const result = await main({
      communityId: 'test-community',
      type: 'vote',
      title: 'Test Vote',
      detail: 'Test detail'
    }, {});
    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
  });
});
```

### 3.4 Mock 策略
- `wx-server-sdk`：完整 mock（`cloud.init`, `cloud.database`, `cloud.getWXContext`）
- 无需 mock `wx.cloud.callFunction`（测试时直接调用 `exports.main`）
- 无需 mock 微信 API（不涉及）

### 3.5 测试覆盖
- ✅ 正常入参 → `{ success: true }`
- ✅ 缺少必填字段 → `{ success: false, error }`
- ✅ 数据库异常 → `{ success: false, error }`（无泄露）

### 3.6 覆盖率目标
- 初期 40%，目标 70%

---

## 四、微信小程序测试

### 4.1 初期阶段（当前）
- 框架：**Jest**（纯 JS 工具函数测试）
- 范围：`miniprogram/utils/` 下的工具函数

### 4.2 中期阶段（后续）
- 框架：**miniprogram-simulate**（组件测试）
- 范围：`miniprogram/components/` 下的组件

### 4.3 覆盖率目标
- 工具函数：初期 50%，目标 80%
- 组件：后续制定

---

## 五、测试运行命令

```bash
# 管理前端
cd admin-frontend && npm test

# 管理后端
cd admin && npm test

# 云函数（逐个运行）
cd cloudfunctions/createVote && npx jest
```

---

## 六、测试编写原则

1. **先写工具函数测试** — 投入产出比最高，最容易覆盖
2. **每个新功能必须有测试** — 不要求 100% 覆盖，但核心流程必须覆盖
3. **Mock 要最小化** — 只 mock 外部依赖（SDK/HTTP），不 mock 被测代码内部逻辑
4. **测试命名要描述场景** — `it('should return error when phone format is invalid')` 而非 `it('test 1')`
5. **一个测试只测一件事** — 避免一个 `it` 中包含多个 `expect`
