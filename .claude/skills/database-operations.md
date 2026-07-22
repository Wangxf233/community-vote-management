# database-operations

数据库操作规范。覆盖 Express 后端（`@cloudbase/node-sdk`）和云函数（`wx-server-sdk`）两套环境。

> ⚠️ 两套 SDK 的限额和 API 存在差异，**禁止混淆使用**。

---

## 一、Express 后端（@cloudbase/node-sdk）

### 1.1 初始化
```javascript
const { db, tcb } = require("../config/db");
// 禁止自行 init cloudbase
```

### 1.2 基本操作

```javascript
// 查询列表
const list = await db.collection("votes")
  .where({ communityId, status: "active" })
  .orderBy("createdAt", "desc")
  .skip((page - 1) * pageSize)
  .limit(pageSize)
  .get();

// 计数
const countRes = await db.collection("votes").where({ communityId }).count();
const total = countRes.total || 0;

// 单条查询
const res = await db.collection("votes").doc(id).get();
// 注意：res.data 可能是数组或单对象，需要防御性处理
let data = res && res.data ? res.data : null;
if (Array.isArray(data)) data = data[0] || null;

// 创建 — 必须用 {data} 包装
await db.collection("votes").add({ data: newDoc });

// 更新 — 必须用 {data} 包装
await db.collection("votes").doc(id).update({ data: updates });

// 删除
await db.collection("votes").doc(id).remove();
```

### 1.3 高级查询
```javascript
const _ = db.command;

// 范围查询
.where({ createdAt: _.gt(startDate).and(_.lt(endDate)) })

// 排除条件
.where({ status: _.neq("deleted") })
.where({ status: _.nin(["deleted", "archived"]) })

// 正则
.where({ name: db.RegExp({ regexp: "张.*", options: "i" }) })

// 逻辑组合
.where(_.and([{ communityId }, { status: "active" }]))
.where(_.or([{ type: "vote" }, { type: "survey" }]))
```

### 1.4 限额与优化
- `.count()` 上限 **1000**，超大数据量使用聚合 `$group` + `$sum`
- 批量写入每次 ≤ 100 条
- 禁止全表扫描：`.where({}).get()` 无条件全量返回

---

## 二、云函数（wx-server-sdk）

### 2.1 初始化
```javascript
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
```

### 2.2 基本操作
```javascript
// 查询列表 — 单次最多返回 100 条！
const list = await db.collection("votes")
  .where({ communityId })
  .orderBy("createdAt", "desc")
  .skip((page - 1) * pageSize)
  .limit(pageSize)
  .get();

// 计数 — 上限 1000
const countRes = await db.collection("votes").where({ communityId }).count();

// 创建
await db.collection("votes").add({ data: newDoc });

// 更新
await db.collection("votes").doc(id).update({ data: updates });

// 删除
await db.collection("votes").doc(id).remove();
```

### 2.3 聚合查询
```javascript
const $ = db.command.aggregate;

const res = await db.collection("vote_records")
  .aggregate()
  .match({ voteId, deleted: _.neq(true) })
  .group({
    _id: "$optionId",
    count: $.sum(1),
    area: $.sum("$area")
  })
  .end();
```
**限额**：聚合查询限制 **20 次/秒**，高并发下需降级或排队。

### 2.4 事务
```javascript
const transaction = await db.startTransaction();
try {
  await transaction.collection("users").doc(userId).update({ data: { ... } });
  await transaction.collection("bindings").add({ data: { ... } });
  await transaction.commit();
} catch (err) {
  await transaction.rollback();
  throw err;
}
```

### 2.5 请求限制
- 前端调用 `wx.cloud.callFunction` 请求体 ≤ **6MB**
- 云函数响应体 ≤ **6MB**
- 执行时间 ≤ **20 秒**

---

## 三、通用规范（两套环境共用）

### 3.1 隐私字段过滤 🔴
查询返回给客户端的记录中，手机号、身份证号统一在数据访问层做掩码处理：

```javascript
// 方案一：查询后映射
const list = res.data.map(item => ({
  ...item,
  phone: maskPhone(item.phone),
  idCard: maskIdCard(item.idCard),
}));

// 方案二：数据库层字段限制（仅返回需要的非隐私字段）
db.collection("users").field({
  _id: true, nickname: true, role: true
  // 不返回 phone, password, token
}).get();
```

### 3.2 索引
- 新集合的查询字段必须创建索引
- 参考：`docs/DATABASE_INDEXES.md`
- 常见索引字段：`communityId`, `openid`, `status`, `createdAt`

### 3.3 N+1 查询禁止
```javascript
// ❌ 循环中查询 — N+1 问题
for (const item of items) {
  const related = await db.collection("xxx").where({ parentId: item._id }).get();
}

// ✅ 批量查询
const parentIds = items.map(i => i._id);
const related = await db.collection("xxx")
  .where({ parentId: db.command.in(parentIds) })
  .get();
```

### 3.4 分页模式
```javascript
// 标准分页
const page = parseInt(event.page) || 1;
const pageSize = Math.min(parseInt(event.pageSize) || 20, 100);  // 上限 100
const skip = (page - 1) * pageSize;

const [listRes, countRes] = await Promise.all([
  db.collection("xxx").where(query).skip(skip).limit(pageSize).get(),
  db.collection("xxx").where(query).count()
]);

return {
  success: true,
  data: listRes.data,
  total: countRes.total,
  page,
  pageSize
};
```
