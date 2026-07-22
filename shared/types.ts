/**
 * 社区物业服务系统 — 共享 TypeScript 类型定义
 *
 * 管理前端直接引用: import type { Vote, Repair } from "@shared/types"
 * Express 后端 JSDoc 引用: /** @typedef {import('../../shared/types').Vote} Vote *​/
 */

// ============================================================
// 基础类型
// ============================================================

/** 用户角色 */
export type UserRole = "super" | "community" | "community_admin" | "admin" | "user";

/** 认证申请类型 */
export type CertType = "owner" | "family" | "realname";

/** 认证申请状态 */
export type CertStatus = "pending" | "approved" | "rejected" | "removed";

/** 投票类型 */
export type VoteType = "vote" | "survey";

/** 投票状态 */
export type VoteStatus = "active" | "paused" | "ended";

/** 报修状态 */
export type RepairStatus = "pending" | "processing" | "completed" | "cancelled";

/** 公告类型 */
export type AnnouncementType = "committee" | "property" | "law" | "industry";

/** 实名认证状态 */
export type RealNameStatus = "unverified" | "pending" | "verified" | "rejected";

/** 门禁位置类型 */
export type DoorLocationType = "community_gate" | "unit_gate";

// ============================================================
// API 通用包装类型
// ============================================================

/** REST API 列表响应 */
export interface ApiListResponse<T> {
  success: true;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** REST API 单条响应 */
export interface ApiDataResponse<T> {
  success: true;
  data: T;
}

/** REST API 操作成功响应 */
export interface ApiSuccessResponse {
  success: true;
}

/** REST API 错误响应 */
export interface ApiErrorResponse {
  success: false;
  error: string;
}

/** 云函数通用返回 */
export interface CloudFunctionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================
// 核心实体类型
// ============================================================

/** 用户 */
export interface User {
  _id: string;
  openid: string;
  nickname: string;
  avatarUrl: string;
  token: string;
  role: UserRole;
  username?: string;
  phone?: string;
  name?: string;
  communityId?: string;
  isPrimaryAdmin?: boolean;
  permissions?: string[];
  mustChangePassword?: boolean;
  createdAt: number;
  updatedAt?: number;
}

/** 社区 */
export interface Community {
  _id: string;
  name: string;
  address?: string;
  district?: string;
  doorManagementEnabled: boolean;
  productEnd?: string;
  endDate?: string;
  product_end?: string;
  end?: string;
  maxAdmins?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** 认证申请 */
export interface CertificationApplication {
  _id: string;
  openid: string;
  type: CertType;
  name: string;
  phone: string;
  communityId: string;
  communityName: string;
  building: string;
  unit: string;
  room: string;
  status: CertStatus;
  region?: string[];
  relation?: string;
  ownerOpenid?: string;
  ownerName?: string;
  inviteCode?: string;
  district?: string;
  doorAccessEnabled?: boolean;
  fondcardId?: string;
  fondcardSerial?: string;
  fondcardUserPassword?: string;
  ownerId?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectReason?: string;
  createdAt: string;
  updatedAt: string;
}

/** 户主名单 */
export interface OwnerRecord {
  _id: string;
  communityId: string;
  name: string;
  phone: string;
  openid: string;
  building: string;
  unit: string;
  room: string;
  area: number;
  carNumber?: string;
  district?: string;
  realNameStatus: RealNameStatus;
  realNameIdCardFront?: string;
  realNameIdCardBack?: string;
  realNameCertType?: string;
  realNameCertImage?: string;
  realNameSubmitTime?: string;
  realNameRejectReason?: string;
  deleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 投票 */
export interface Vote {
  _id: string;
  communityId: string;
  type: VoteType;
  title: string;
  detail: string;
  attachment: string;
  attachmentName: string;
  initiator: string;
  publishTime: Date;
  deadlineTime: Date;
  description: string;
  showResult: boolean;
  status: VoteStatus;
  optionCounts: Record<string, number>;
  totalVotes: number;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** 投票记录 */
export interface VoteRecord {
  _id: string;
  voteId: string;
  openid: string;
  optionId: string;
  area: number;
  deleted?: boolean;
  createdAt?: Date;
}

/** 报修 */
export interface Repair {
  _id: string;
  communityId: string;
  openid: string;
  equipment: string;
  location: string;
  description: string;
  images: string[];
  video?: string;
  status: RepairStatus;
  createdAt: string;
  updatedAt: string;
}

/** 投诉/举报 */
export interface Report {
  _id: string;
  communityId: string;
  title: string;
  description: string;
  images: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

/** 公告 */
export interface Announcement {
  _id: string;
  communityId: string;
  type: AnnouncementType;
  title: string;
  content: string;
  publisher: string;
  attachments?: string[];
  readCount?: number;
  createdAt: string;
  updatedAt: string;
}

/** 门禁设备 */
export interface DoorDevice {
  _id: string;
  communityId: string;
  name: string;
  serial: string;
  password?: string;
  devicePassword?: string;
  locationType: DoorLocationType;
  building?: string;
  unit?: string;
  enabled: boolean;
  openParams?: Record<string, unknown>;
  createdAt?: string;
}

/** 门禁开门日志 */
export interface DoorOpenLog {
  _id: string;
  communityId: string;
  deviceId: string;
  openid: string;
  openedAt: string;
  method?: string;
  success?: boolean;
}

/** 绑定记录 */
export interface Binding {
  _id: string;
  openid: string;
  communityId: string;
  status: "pending" | "approved" | "rejected";
  name?: string;
  phone?: string;
  building?: string;
  block?: string;
  room?: string;
  carNumber?: string;
  residentialArea?: number;
  commercialArea?: number;
  parkingArea?: number;
  rejectReason?: string;
  updatedAt?: string;
}

/** 家庭邀请码 */
export interface FamilyInviteCode {
  _id: string;
  code: string;
  ownerOpenid: string;
  status: "active" | "used";
  expiresAt: string;
  usedBy?: string;
  usedAt?: string;
  createdAt: string;
}

/** 业主名册记录 */
export interface OwnerRegistry {
  _id: string;
  communityId: string;
  building: string;
  unit: string;
  room: string;
  ownerName1?: string;
  ownerName2?: string;
  area?: number;
  carNumber?: string;
  realNameStatus?: RealNameStatus;
  realNameIdCardFront?: string;
  realNameIdCardBack?: string;
  realNameCertType?: string;
  realNameCertImage?: string;
  realNameSubmitTime?: string;
  realNameRejectReason?: string;
  deleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 分页参数
// ============================================================

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginationResult {
  page: number;
  pageSize: number;
  total: number;
}
