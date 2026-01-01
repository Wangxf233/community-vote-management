# 小程序认证系统 - 云函数说明文档

## 已实现的云函数

### 1. submitCertification (认证申请提交)

**路径**: `cloudfunctions/submitCertification/`

**功能**: 处理户主和家属的认证申请

**户主注册参数**:

```javascript
{
  type: 'owner',
  name: '姓名',
  phone: '手机号',
  region: ['省', '市', '区'],
  communityName: '小区名称',
  district: '片区',
  building: '栋号',
  unit: '单元号',
  room: '房号'
}
```

**家属注册参数**:

```javascript
{
  type: 'family',
  inviteCode: '邀请码',
  name: '姓名',
  phone: '手机号',
  relation: '与户主关系'
}
```

**返回格式**:

```javascript
{
  code: 0,  // 0=成功, -1=失败
  message: '提示信息'
}
```

---

### 2. getHouseConfig (获取房屋配置)

**路径**: `cloudfunctions/getHouseConfig/`

**功能**: 根据小区名称获取房屋结构配置

**参数**:

```javascript
{
  communityName: "小区名称";
}
```

**返回格式**:

```javascript
{
  code: 0,
  data: {
    buildings: [
      {
        name: '1栋',
        units: [
          {
            name: '1单元',
            rooms: ['101', '102', '103']
          }
        ]
      }
    ]
  }
}
```

---

### 3. getBindingInfo (获取绑定信息)

**路径**: `cloudfunctions/getBindingInfo/`

**功能**: 获取用户的认证状态和绑定信息

**参数**: 无需参数，自动获取当前用户 openid

**返回格式**:

```javascript
{
  success: true,
  binding: {
    _id: '记录ID',
    type: 'owner' | 'family',
    name: '姓名',
    phone: '手机号',
    communityId: '小区ID',
    communityName: '小区名称',
    building: '栋号',
    unit: '单元号',
    room: '房号',
    status: 'pending' | 'approved' | 'rejected',
    rejectReason: '拒绝原因'
  }
}
```

---

### 4. generateInviteCode (生成家属邀请码)

**路径**: `cloudfunctions/generateInviteCode/`

**功能**: 户主生成家属邀请码

**参数**: 无需参数，自动获取当前户主 openid

**返回格式**:

```javascript
{
  code: 0,
  data: {
    inviteCode: 'ABC12345',  // 8位邀请码
    expiresAt: '2025-12-09T00:00:00.000Z'  // 过期时间(7天后)
  }
}
```

**限制**: 仅已认证的户主可以生成邀请码

---

### 5. getFamilyList (获取家属列表)

**路径**: `cloudfunctions/getFamilyList/`

**功能**: 户主查看自己的家属列表

**参数**: 无需参数，自动获取当前户主 openid

**返回格式**:

```javascript
{
  code: 0,
  data: {
    list: [
      {
        _id: '记录ID',
        name: '家属姓名',
        phone: '手机号',
        relation: '关系',
        status: 'pending' | 'approved' | 'rejected',
        createdAt: '创建时间',
        updatedAt: '更新时间'
      }
    ],
    total: 5
  }
}
```

**限制**: 仅已认证的户主可以查看

---

## 数据库集合

### certification_applications (认证申请表)

存储户主和家属的认证申请记录

**字段说明**:

- `openid`: 微信用户标识
- `type`: 类型 ('owner' | 'family')
- `name`: 姓名
- `phone`: 手机号
- `communityId`: 小区 ID
- `communityName`: 小区名称
- `district`: 片区
- `building`: 栋号
- `unit`: 单元号
- `room`: 房号
- `status`: 审核状态 ('pending' | 'approved' | 'rejected')
- `ownerOpenid`: 户主 openid (仅家属有)
- `ownerName`: 户主姓名 (仅家属有)
- `relation`: 与户主关系 (仅家属有)
- `inviteCode`: 使用的邀请码 (仅家属有)
- `rejectReason`: 拒绝原因
- `createdAt`: 创建时间
- `updatedAt`: 更新时间

---

### family_invite_codes (家属邀请码表)

存储户主生成的邀请码

**字段说明**:

- `code`: 邀请码 (8 位)
- `ownerOpenid`: 户主 openid
- `ownerName`: 户主姓名
- `communityId`: 小区 ID
- `communityName`: 小区名称
- `building`: 栋号
- `unit`: 单元号
- `room`: 房号
- `status`: 状态 ('active' | 'used')
- `usedBy`: 使用者 openid
- `usedAt`: 使用时间
- `expiresAt`: 过期时间
- `createdAt`: 创建时间
- `updatedAt`: 更新时间

---

### house_config (房屋配置表)

存储小区的房屋结构配置

**字段说明**:

- `communityId`: 小区 ID
- `buildings`: 房屋结构数组
- `createdAt`: 创建时间
- `updatedAt`: 更新时间

---

## 部署说明

### 1. 上传云函数

在微信开发者工具中，右键各个云函数文件夹，选择"上传并部署：云端安装依赖"

需要部署的云函数：

- submitCertification
- getHouseConfig
- getBindingInfo (已存在，已修改)
- generateInviteCode
- getFamilyList

### 2. 配置数据库权限

在云开发控制台 → 数据库 → 权限设置中，为以下集合设置权限：

- `certification_applications`: 仅管理员可写，用户可读自己的记录
- `family_invite_codes`: 仅管理员可写，户主可读自己生成的
- `house_config`: 所有用户可读

### 3. 测试流程

1. 户主注册 → 调用 submitCertification (type: 'owner')
2. 管理员审核 → 在后台审核通过
3. 户主生成邀请码 → 调用 generateInviteCode
4. 家属使用邀请码注册 → 调用 submitCertification (type: 'family')
5. 管理员审核家属 → 在后台审核通过
6. 户主查看家属列表 → 调用 getFamilyList

---

## 注意事项

1. **手机号验证**: 使用正则 `/^1[3-9]\d{9}$/` 验证手机号格式
2. **邀请码过期**: 邀请码有效期为 7 天
3. **房号唯一性**: 同一房号只能有一个已认证的户主
4. **家属关联**: 家属注册后会自动关联到户主的房号
5. **状态流转**: pending → approved/rejected
6. **错误处理**: 所有云函数都有 try-catch 包裹，返回统一的错误格式
