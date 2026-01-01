# 切换小区功能实现说明

## 功能概述

实现了用户在多个小区之间切换的功能，支持用户添加新小区并在审核通过后进行切换。

## 实现的功能

### 1. 切换小区页面

**文件位置**: `miniprogram/pages/switch-community/`

**页面功能**:

- 顶部显示当前绑定的小区信息（带"当前"标识）
- 中间列表显示用户其他已审核通过的小区
- 页面底部有"添加新小区"按钮
- 点击其他小区可切换到该小区
- 点击"添加新小区"可以注册新的小区认证

**页面结构**:

- `index.wxml` - 页面结构
- `index.wxss` - 页面样式
- `index.js` - 页面逻辑
- `index.json` - 页面配置

### 2. 云函数：getUserCommunities

**文件位置**: `cloudfunctions/getUserCommunities/`

**功能**:

- 获取用户所有已审核通过（status: 'approved'）的小区绑定信息
- 按更新时间降序排列
- 返回完整的小区信息，包括地址、房号等

**返回数据结构**:

```javascript
{
  success: true,
  bindings: [
    {
      _id: "绑定ID",
      type: "owner/family",
      communityName: "小区名称",
      communityId: "小区ID",
      region: ["省", "市", "区"],
      district: "区/期号",
      building: "楼号",
      unit: "单元",
      room: "房号",
      status: "approved",
      // ...其他字段
    }
  ],
  count: 2
}
```

### 3. 修改的文件

#### 3.1 个人中心页面

**文件**: `miniprogram/pages/profile/index.js`

- 修改 `goToSettings` 方法，点击"切换小区"时跳转到切换小区页面

#### 3.2 户主注册页面

**文件**: `miniprogram/pages/owner-register/index.js`

- 添加 `isAdding` 参数，区分首次注册和添加新小区两种模式
- 在添加新小区模式下，提交成功后返回切换小区页面
- 在首次注册模式下，提交成功后跳转到首页

#### 3.3 家属注册页面

**文件**: `miniprogram/pages/family-register/index.js`

- 添加 `isAdding` 参数，区分首次注册和添加新小区两种模式
- 在添加新小区模式下，提交成功后返回切换小区页面
- 在首次注册模式下，提交成功后跳转到首页

#### 3.4 应用配置

**文件**: `miniprogram/app.json`

- 在 pages 数组中注册新页面 `pages/switch-community/index`

## 使用流程

### 切换已有小区

1. 进入个人中心页面
2. 点击"切换小区"菜单项
3. 在切换小区页面查看当前小区和其他已审核通过的小区
4. 点击其他小区卡片进行切换
5. 切换成功后自动返回个人中心

### 添加新小区

1. 进入切换小区页面
2. 点击底部"添加新小区"按钮
3. 选择身份类型（户主/家属）
4. 填写新小区的认证信息并提交
5. 提交成功后返回切换小区页面
6. 等待审核通过后，该小区会出现在切换小区列表中

## 技术要点

### 1. 小区数据管理

- 使用 `app.globalData.communityId` 存储当前小区 ID
- 使用 `app.globalData.bindingInfo` 存储当前绑定信息
- 同时在本地存储中备份 `communityId` 和 `bindingStatus`

### 2. 审核状态过滤

- 只显示状态为 `approved` 的小区
- 待审核（pending）和已拒绝（rejected）的不显示在列表中
- 但在添加新小区提交后会提示等待审核

### 3. 页面导航

- 首次注册使用 `wx.switchTab` 或 `wx.reLaunch` 跳转到首页
- 添加新小区使用 `wx.navigateTo` 进入注册页，使用 `wx.navigateBack` 返回
- 切换小区使用 `wx.navigateBack` 返回上一页

### 4. 地址格式化

- 在切换小区页面将地址信息组合成完整地址显示
- 格式：省市区 + 区/期号 + 楼号 + 单元 + 房号

## 注意事项

1. **云函数部署**: 需要部署新的云函数 `getUserCommunities`
2. **数据库权限**: 确保云函数有权限读取 `certification_applications` 集合
3. **审核状态同步**: 切换小区后需要刷新相关页面的数据
4. **未读消息**: 切换小区后可能需要重新获取新小区的未读公告等信息

## 后续优化建议

1. 添加小区切换动画效果
2. 在切换小区时显示该小区的基本信息预览
3. 支持删除/解绑某个小区
4. 添加小区切换历史记录
5. 优化页面刷新机制，切换小区后自动刷新所有相关数据
