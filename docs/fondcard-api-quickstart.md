# Fondcard API 快速接入（当前项目）

## 1. 已实现接口

以下接口均在 admin 服务，且需要管理员 token：

- POST /api/door/fondcard/login/add
- POST /api/door/fondcard/login/query （查询已存在 loginId）
- POST /api/door/fondcard/device/add
- POST /api/door/fondcard/login-device/add
- POST /api/door/fondcard/user/add
- POST /api/door/fondcard/key/add
- POST /api/door/fondcard/mqtt-key/update
- POST /api/door/fondcard/login/update
- POST /api/door/fondcard/bootstrap （一键跑通主流程）

## 2. 你提供的参数映射

- name -> 用户名（wyh）
- loginPassword -> 管理用户密码（wyh250303，调用时会自动转 md5）
- company -> antai
- platform -> antai
- serial -> Gy6aZ
- devicePassword -> 11192850
- deviceNo -> 10069707
- deviceType -> 1（门禁）
- algorithm -> 1
- sourceid -> 70231
- sn -> 10069707
- mac -> 8C41F20B13CC
- id -> F20B13CC
- startDate -> 1768924800
- keyDate -> 1798761600

## 3. bootstrap 必填参数状态

按当前已确认参数，`/api/door/fondcard/bootstrap` 必填项已补齐。

可选但建议提供：

- periodNo（默认0，不限时段）

固定规则（已在 bootstrap 内强制执行）：

- keyType 固定为 1（APPID 权限）
- keyId 固定由 data.user.add 返回的 id 转 8 位16进制

## 4. 关键说明

- 文档里部分参数来自前置接口返回值：
  - loginId：来自 data.login.add
  - user.id：来自 data.user.add
  - keyId：通常由 user.id 转 8 位16进制得到
- 本项目 bootstrap 已按这个依赖顺序串起来。
- 厂商错误码 1006 表示“设备已存在”，bootstrap 已兼容该场景：第2步会跳过新增并继续后续步骤。

## 5. 环境变量

admin/.env 里需配置：

- FONDCARD_API_BASE_URL
- FONDCARD_API_TIMEOUT_MS

## 6. 直接调用示例（algorithm=1）

请求地址：

- POST /api/door/fondcard/bootstrap

请求头：

- Authorization: Bearer <管理员token>
- Content-Type: application/json

请求体示例：

```json
{
  "name": "wyh1",
  "loginPassword": "wyh250303",
  "company": "antai",
  "platform": "antai",
  "serial": "Gy6aZ",
  "devicePassword": "11192850",
  "deviceNo": 10069707,
  "deviceType": 1,
  "algorithm": 1,
  "sourceid": "70231",
  "sn": "10069707",
  "mac": "8C41F20B13CC",
  "id": "F20B13CC",
  "startDate": 1768924800,
  "keyDate": 1798761600,
  "periodNo": "0"
}
```

curl 示例（本机 admin 默认 3000 端口）：

```bash
curl -X POST "http://127.0.0.1:3000/api/door/fondcard/bootstrap" \
  -H "Authorization: Bearer d4db7df1941989cd6dcfeb996886c4d3" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"wyh1\",\"loginPassword\":\"wyh250303\",\"company\":\"antai\",\"platform\":\"antai\",\"serial\":\"Gy6aZ\",\"devicePassword\":\"11192850\",\"deviceNo\":10069707,\"deviceType\":1,\"algorithm\":1,\"sourceid\":\"70231\",\"sn\":\"10069707\",\"mac\":\"8C41F20B13CC\",\"id\":\"F20B13CC\",\"startDate\":1768924800,\"keyDate\":1798761600,\"periodNo\":\"0\"}"
```

## 7. 查询 loginId 示例

请求地址：

- POST /api/door/fondcard/login/query

请求体示例（按平台+名称查询）：

```json
{
  "platform": "antai",
  "company": "antai",
  "name": "wyh"
}
```

PowerShell 示例：

```powershell
$headers = @{ Authorization = "Bearer <管理员token>"; "Content-Type" = "application/json" }
$body = '{"platform":"antai","company":"antai","name":"wyh"}'
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/door/fondcard/login/query" -Method POST -Headers $headers -Body $body
```

返回里优先看：

- data.matchedLoginId（可直接用于 bootstrap 的 loginId）
