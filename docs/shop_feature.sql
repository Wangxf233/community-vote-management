-- ============================================================================
-- 商铺业务 数据库变更脚本（2026-09-06）
-- 数据库类型：微信 CloudBase NoSQL（类 MongoDB 文档型数据库）
--
-- 说明：
-- 1. CloudBase 集合无需显式建表：代码首次写入（.add()）时集合自动创建。
--    本脚本以 SQL 语法描述集合结构与索引，作为结构文档 + 索引创建参考。
-- 2. 索引创建方式：
--    - 方式一：CloudBase 控制台 → 数据库 → 集合 → 索引管理 → 新增索引
--    - 方式二：CloudBase CLI（示例）：
--      tcb db index set --envId <环境ID> --collection shop_registry \
--        --index '[{"name":"idx_communityId_owner","unique":false,"keys":[{"name":"communityId","direction":1},{"name":"ownerName1","direction":1}]}]'
-- 3. 商铺与房屋业务完全隔离：本次全部为【新增】集合，不改动任何既有集合结构。
--    （房屋侧唯一改动为 certification.js 审核通过时把 remark 同步到 owner_list，
--      属于代码修复，owner_list 集合本身已存在 remark 字段，无需结构变更。）
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. shop_config（商铺配置）—— 每个小区一条，管理后台"商铺配置"Tab 维护
--    门牌号与商铺名【一一对应】，一行 = 一个商铺，两项均选填；
--    未配置时小程序端对应下拉框置灰禁用。
--    兼容旧结构：早期版本曾存 houseNumbers[]/shopNames[] 两个独立数组，
--    读取时自动按下标配对转换，无需数据迁移。
-- ----------------------------------------------------------------------------
CREATE TABLE shop_config (
  _id          TEXT PRIMARY KEY,   -- CloudBase 自动生成
  communityId  TEXT NOT NULL,      -- 小区 ID（users 文档顶层 communityId）
  shops        TEXT[],             -- 商铺配置行数组：[{houseNumber, shopName}]，两字段均选填，全空行自动丢弃
  createdAt    TEXT,               -- ISO 时间字符串
  updatedAt    TEXT                -- ISO 时间字符串
);
-- 索引：communityId 唯一（每小区一条配置）
CREATE UNIQUE INDEX idx_shop_config_communityId ON shop_config (communityId);


-- ----------------------------------------------------------------------------
-- 2. shop_registry（商铺名册 = 业主名册-商铺）—— 一条 = 一个商铺
--    数据来源：管理后台手动添加 / Excel 导入；状态枚举复用房屋业务
-- ----------------------------------------------------------------------------
CREATE TABLE shop_registry (
  _id          TEXT PRIMARY KEY,
  communityId  TEXT NOT NULL,
  ownerName1   TEXT NOT NULL,      -- 户主姓名【必填】
  ownerName2   TEXT,               -- 备用户主姓名（与 owner_registry 对齐）
  houseNumber  TEXT,               -- 门牌号【选填】
  shopName     TEXT,               -- 商铺名【选填】
  area         NUMBER,             -- 专有面积【必填】
  remark       TEXT,               -- 备注【选填】
  status       TEXT,               -- 导入状态："valid" | "invalid"（复用 owner_registry.status 枚举）
  -- 实名认证字段（复用房屋枚举："unverified" | "pending" | "verified" | "rejected"）
  realNameStatus         TEXT,
  realNameIdCardFront    TEXT,
  realNameIdCardBack     TEXT,
  realNameCertType       TEXT,     -- property | contract | payment
  realNameCertImage      TEXT,
  realNameSubmitTime     TEXT,
  realNameRejectReason   TEXT,
  openid       TEXT,               -- 小程序用户 openid（实名提交流程回写，可能为空）
  createdAt    TEXT,
  updatedAt    TEXT
);
-- 索引
CREATE INDEX idx_shop_registry_communityId ON shop_registry (communityId);
-- 手动添加/导入去重：同户主 + 同门牌号 + 同商铺名
CREATE INDEX idx_shop_registry_owner_shop ON shop_registry (communityId, ownerName1, houseNumber, shopName);


-- ----------------------------------------------------------------------------
-- 3. shop_certification_applications（商铺认证申请）—— 一条 = 一个申请
--    数据来源：小程序 submitCertification 云函数（type:"shop" 分支）
--    与房屋的 certification_applications 完全隔离
-- ----------------------------------------------------------------------------
CREATE TABLE shop_certification_applications (
  _id          TEXT PRIMARY KEY,
  openid       TEXT NOT NULL,      -- 申请人 openid
  type         TEXT,               -- 固定 "shop"
  name         TEXT,               -- 户主姓名
  phone        TEXT,               -- 手机号
  region       TEXT[],             -- [省, 市, 区]
  communityId  TEXT NOT NULL,
  communityName TEXT,
  houseNumber  TEXT,               -- 门牌号（选填，后台无配置时为空字符串）
  shopName     TEXT,               -- 商铺名（选填，后台无配置时为空字符串）
  status       TEXT,               -- 注册认证状态："pending" | "approved" | "rejected" | "removed"
  reviewedAt   TEXT,
  reviewedBy   TEXT,               -- 审核管理员 _id
  rejectReason TEXT,               -- 拒绝原因
  createdAt    TEXT,
  updatedAt    TEXT
);
-- 索引
CREATE INDEX idx_shop_cert_communityId ON shop_certification_applications (communityId, status);
-- 小程序重复申请校验：同 openid + 同小区 + pending/approved
CREATE INDEX idx_shop_cert_openid_community ON shop_certification_applications (openid, communityId, status);
-- 商铺占用校验：同小区 + 同门牌号 + 同商铺名
CREATE INDEX idx_shop_cert_community_shop ON shop_certification_applications (communityId, houseNumber, shopName);


-- ----------------------------------------------------------------------------
-- 4. shop_owner_list（商铺户主名单）—— 一条 = 一个商铺
--    数据来源：认证审核通过时自动从 shop_registry 同步
--    （专有面积、备注由商铺名册带入，实名信息一并恢复）
-- ----------------------------------------------------------------------------
CREATE TABLE shop_owner_list (
  _id          TEXT PRIMARY KEY,
  communityId  TEXT NOT NULL,
  name         TEXT NOT NULL,      -- 户主姓名
  phone        TEXT,               -- 手机号
  houseNumber  TEXT,               -- 门牌号
  shopName     TEXT,               -- 商铺名
  area         NUMBER,             -- 专有面积（从 shop_registry 同步）
  remark       TEXT,               -- 备注（从 shop_registry 同步）
  openid       TEXT,
  -- 实名认证字段（复用房屋枚举）
  realNameStatus         TEXT,
  realNameIdCardFront    TEXT,
  realNameIdCardBack     TEXT,
  realNameCertType       TEXT,
  realNameCertImage      TEXT,
  realNameSubmitTime     TEXT,
  realNameRejectReason   TEXT,
  createdAt    TEXT,
  updatedAt    TEXT
);
-- 索引
CREATE INDEX idx_shop_owner_list_communityId ON shop_owner_list (communityId);
-- 审核通过同步去重：同小区 + 同户主 + 同门牌号 + 同商铺名
CREATE INDEX idx_shop_owner_list_owner_shop ON shop_owner_list (communityId, name, houseNumber, shopName);
-- 按 openid 查询（实名认证回写/户主列表）
CREATE INDEX idx_shop_owner_list_openid ON shop_owner_list (openid);


-- ============================================================================
-- 数据流转关系（本次核心逻辑）
-- ============================================================================
-- 认证审核通过（POST /api/shop-certification-applications/:id/review, action=approved）
--   shop_registry（按 ownerName1/ownerName2 = 申请人姓名匹配）
--     └─ 逐条同步 → shop_owner_list：area、remark 由商铺名册带入，
--        已存在（同户主+同门牌号+同商铺名）则跳过
--
-- 房屋 BUG 修复（POST /api/certification-applications/:id/review, action=approved）
--   owner_registry（按 ownerName1/ownerName2 = 申请人姓名匹配）
--     └─ 逐条同步 → owner_list：新增 remark 字段带入（此前丢失）
-- ============================================================================
