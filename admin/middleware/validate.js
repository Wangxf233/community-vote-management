/**
 * 输入验证中间件 — 基于 Zod schema 的声明式校验
 *
 * 使用方式：
 *   const { validate } = require("../middleware/validate");
 *   router.post("/repairs", authMiddleware, validate("createRepair"), async (req, res) => { ... });
 *   // 校验通过后，req.validatedBody 包含类型安全的数据
 */

const { z } = require("zod");

// ============================================================
// Schema 定义 — 按资源分组的输入校验规则
// ============================================================

const schemas = {
  // === 报修 ===
  createRepair: z.object({
    communityId: z.string().min(1, "小区ID不能为空"),
    equipment: z.string().min(1, "设备名称不能为空"),
    location: z.string().min(1, "位置不能为空"),
    description: z.string().min(1, "描述不能为空"),
    images: z.array(z.string()).optional(),
    video: z.string().optional(),
  }),

  // === 举报/投诉 ===
  createReport: z.object({
    communityId: z.string().min(1),
    title: z.string().min(1, "标题不能为空"),
    description: z.string().min(1, "描述不能为空"),
    images: z.array(z.string()).optional(),
  }),

  // === 认证审核 ===
  reviewCertification: z.object({
    action: z.enum(["approved", "rejected"]),
    reason: z.string().optional(),
  }),

  // === 业主审核 ===
  auditResident: z.object({
    status: z.enum(["approved", "rejected"]),
    rejectReason: z.string().optional(),
  }),

  // === 公告 ===
  createAnnouncement: z.object({
    communityId: z.string().min(1),
    type: z.enum(["committee", "property", "law", "industry"]),
    title: z.string().min(1, "标题不能为空"),
    content: z.string().min(1, "内容不能为空"),
    publisher: z.string().min(1, "发布者不能为空"),
    attachments: z.array(z.string()).optional(),
  }),

  // === 通知 ===
  createNotification: z.object({
    communityId: z.string().min(1),
    title: z.string().min(1, "标题不能为空"),
    content: z.string().min(1, "内容不能为空"),
    targetType: z.enum(["all", "owners"]).optional(),
  }),

  // === 投票 ===
  createVote: z.object({
    communityId: z.string().min(1),
    type: z.enum(["vote", "survey"]),
    title: z.string().min(1, "标题不能为空"),
    detail: z.string().min(1, "详情不能为空"),
    attachment: z.string().optional(),
    attachmentName: z.string().optional(),
    initiator: z.string().optional(),
    publishTime: z.string().optional(),
    deadlineTime: z.string().optional(),
    description: z.string().optional(),
    showResult: z.boolean().optional(),
  }),

  // === 评价 ===
  createEvaluation: z.object({
    communityId: z.string().min(1),
    name: z.string().min(1, "姓名不能为空"),
    position: z.string().min(1, "岗位不能为空"),
    workScope: z.string().min(1, "工作范围不能为空"),
  }),

  // === 用户注册 ===
  register: z.object({
    username: z.string().min(1, "用户名不能为空").max(50),
    password: z.string().min(6, "密码至少6位").max(100),
    phone: z.string().regex(/^1[3-9]\d{9}$/, "手机号格式不正确"),
    communityName: z.string().min(1, "小区名称不能为空"),
    verifyCode: z.string().min(1, "验证码不能为空"),
  }),

  // === 修改密码 ===
  changePassword: z.object({
    oldPassword: z.string().min(1),
    newPassword: z.string().min(6, "新密码至少6位").max(100),
  }),

  // === 业主信息修改 ===
  updateResident: z.object({
    name: z.string().optional(),
    phone: z.string().regex(/^1[3-9]\d{9}$/, "手机号格式不正确").optional(),
    building: z.string().optional(),
    block: z.string().optional(),
    room: z.string().optional(),
    residentialArea: z.union([z.string(), z.number()]).optional(),
    commercialArea: z.union([z.string(), z.number()]).optional(),
    parkingArea: z.union([z.string(), z.number()]).optional(),
    carNumber: z.string().optional(),
  }),

  // === 门禁设备 ===
  createDoorDevice: z.object({
    communityId: z.string().min(1),
    name: z.string().min(1, "设备名称不能为空"),
    serial: z.string().min(1, "设备序列号不能为空"),
    password: z.string().optional(),
    locationType: z.enum(["community_gate", "unit_gate"]).optional(),
    building: z.string().optional(),
    unit: z.string().optional(),
    enabled: z.boolean().optional(),
  }),
};

// ============================================================
// 校验中间件工厂函数
// ============================================================

/**
 * 创建校验中间件
 * @param {string} schemaName - schemas 中的 key
 * @returns {Function} Express 中间件
 */
function validate(schemaName) {
  const schema = schemas[schemaName];

  if (!schema) {
    throw new Error(`Validation schema "${schemaName}" not found`);
  }

  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "validation_error",
        details: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    // 校验通过的数据挂载到 req 上
    req.validatedBody = result.data;
    next();
  };
}

module.exports = { validate, schemas };
