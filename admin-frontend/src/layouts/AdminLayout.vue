<template>
  <div class="admin-layout">
    <el-container style="height: 100vh">
      <el-aside width="200px" class="aside">
        <div class="logo">业主投票评价系统管理后台</div>
        <el-menu
          :default-active="active"
          class="el-menu-vertical-demo"
          @select="onSelect"
        >
          <el-menu-item index="/admin/add">
            <el-icon><CirclePlus /></el-icon>
            <span>添加小区</span>
          </el-menu-item>
          <el-menu-item index="/admin/list">
            <el-icon><List /></el-icon>
            <span>小区列表</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-container>
        <el-header class="topbar">
          <div class="left">
            <!-- 可放置面包屑/标题 -->
          </div>
          <div class="right">
            <el-tooltip content="刷新" placement="bottom">
              <el-button text circle @click="emitRefresh">
                <el-icon><Refresh /></el-icon>
              </el-button>
            </el-tooltip>

            <el-badge
              :value="expiringCount"
              :hidden="expiringCount === 0"
              class="topbar-item"
            >
              <el-tooltip content="到期提醒" placement="bottom">
                <el-button text circle @click="openExpiringDialog">
                  <el-icon><Bell /></el-icon>
                </el-button>
              </el-tooltip>
            </el-badge>

            <el-tooltip
              :content="isLargeFont ? '切换到标准字号' : '切换到大字号'"
              placement="bottom"
            >
              <el-button
                text
                circle
                @click="toggleFontSize"
                class="topbar-item"
              >
                <span style="font-size: 16px; font-weight: bold">{{
                  isLargeFont ? "A-" : "A+"
                }}</span>
              </el-button>
            </el-tooltip>

            <el-popover placement="bottom-end" trigger="hover" width="240">
              <template #reference>
                <el-button text circle class="topbar-item">
                  <el-icon><User /></el-icon>
                </el-button>
              </template>
              <div class="profile-pop">
                <div class="row">
                  <span class="label">用户名</span
                  ><span class="val">{{ username || "-" }}</span>
                </div>
                <div class="row">
                  <span class="label">账号</span
                  ><span class="val">{{ account || username || "-" }}</span>
                </div>
                <div class="footer">
                  <el-button size="small" type="danger" @click="logout"
                    >退出登录</el-button
                  >
                </div>
              </div>
            </el-popover>
          </div>
        </el-header>
        <el-dialog
          v-model="expiringDialog"
          title="有效期不足30天的小区"
          width="640px"
        >
          <el-table :data="expiringList" size="small" style="width: 100%">
            <el-table-column label="小区名称" prop="name" />
            <el-table-column label="到期时间" width="160">
              <template #default="{ row }">{{
                formatDate(
                  row.productEnd || row.endDate || row.product_end || row.end,
                )
              }}</template>
            </el-table-column>
            <el-table-column label="剩余(天)" width="100">
              <template #default="{ row }">{{ computeDays(row) }}</template>
            </el-table-column>
          </el-table>
          <template #footer>
            <el-button type="primary" @click="expiringDialog = false"
              >知道了</el-button
            >
          </template>
        </el-dialog>
        <el-main style="padding: 16px; overflow: hidden">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
    <!-- 首次登录强制修改密码 -->
    <el-dialog
      v-model="pwdDialog"
      title="请修改初始密码"
      width="420px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
    >
      <el-form :model="pwdForm" label-width="120px">
        <el-form-item label="新密码">
          <el-input v-model="pwdForm.newPassword" type="password" />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input v-model="pwdForm.confirm" type="password" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="submitPwd">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive, computed as vComputed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import request from "../utils/axios";
import { Refresh, Bell, User, CirclePlus, List } from "@element-plus/icons-vue";
const router = useRouter();
const route = useRoute();
const active = computed(() => route.path);
function onSelect(path: string) {
  router.push(path);
}

// 顶部栏：夜间模式
const isDark = ref(false);
function applyDark(v: boolean) {
  const root = document.documentElement;
  if (v) root.classList.add("dark");
  else root.classList.remove("dark");
  localStorage.setItem("admin-dark", v ? "1" : "0");
  isDark.value = v;
}
function toggleDark() {
  applyDark(!isDark.value);
}

// 顶部栏：字号切换
const isLargeFont = ref(false);
function applyFontSize(v: boolean) {
  const root = document.documentElement;
  if (v) root.classList.add("large-font");
  else root.classList.remove("large-font");
  localStorage.setItem("admin-large-font", v ? "1" : "0");
  isLargeFont.value = v;
}
function toggleFontSize() {
  applyFontSize(!isLargeFont.value);
}

// 顶部栏：账号
const username = ref("");
const account = ref("");
function initUser() {
  try {
    const raw = localStorage.getItem("admin-user");
    if (raw) {
      const u = JSON.parse(raw);
      username.value = u?.username || u?.nickName || "管理员";
      account.value = u?.username || u?.phone || "";
    }
  } catch {}
  applyDark(localStorage.getItem("admin-dark") === "1");
  applyFontSize(localStorage.getItem("admin-large-font") === "1");
}
function logout() {
  localStorage.removeItem("admin-token");
  localStorage.removeItem("admin-user");
  ElMessage.success("退出成功");
  router.push("/login");
}

// 顶部栏：刷新
function emitRefresh() {
  try {
    window.dispatchEvent(new Event("admin-refresh"));
  } catch {}
  // 直接整体刷新，确保各页面数据更新（无需逐页改动）
  setTimeout(() => {
    try {
      location.reload();
    } catch {}
  }, 50);
}

// 顶部栏：到期提醒
const communities = ref<any[]>([]);
const expiringDialog = ref(false);
const hasReadExpiring = ref(false); // 是否已查看过提醒
const expiringList = vComputed(() => {
  return (communities.value || []).filter((c) => {
    const d = computeDays(c);
    const n = typeof d === "number" ? d : d === "已到期" ? 0 : 99999;
    return n <= 30;
  });
});
const expiringCount = vComputed(() => {
  // 如果已读且列表没有变化，不显示红点
  if (hasReadExpiring.value) return 0;
  return expiringList.value.length;
});

function toTimestamp(val: any): number | null {
  if (!val) return null;
  try {
    if (val instanceof Date) return val.getTime();
    if (typeof val === "number") return val < 1e12 ? val * 1000 : val;
    if (typeof val === "string") return Date.parse(val);
    if (val && typeof val === "object" && (val.$date || val.date)) {
      return toTimestamp(val.$date || val.date);
    }
  } catch {}
  return null;
}
function getStart(r: any) {
  return r?.productStart ?? r?.startDate ?? r?.product_start ?? r?.start;
}
function getEnd(r: any) {
  return r?.productEnd ?? r?.endDate ?? r?.product_end ?? r?.end;
}
function formatDate(v: any) {
  const ts = toTimestamp(v);
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getDate()).padStart(2, "0")}`;
}
function computeDays(r: any) {
  const e = toTimestamp(getEnd(r));
  if (!e) return "-";
  try {
    const now = Date.now();
    const days = Math.ceil((e - now) / (24 * 3600 * 1000));
    if (days <= 0) return "已到期";
    return days;
  } catch {
    return "-";
  }
}

async function loadExpiring() {
  try {
    const body = await request.get("/communities", {
      params: { page: 1, pageSize: 1000 },
    });
    communities.value = body.data || body || [];

    // 检查已读状态
    const savedHash = localStorage.getItem("admin-expiring-read");
    const currentHash = JSON.stringify(
      expiringList.value.map((c: any) => c._id).sort(),
    );
    // 如果列表发生变化（有新的即将到期小区），重置已读状态
    if (savedHash !== currentHash) {
      hasReadExpiring.value = false;
    } else {
      hasReadExpiring.value = true;
    }
  } catch (e) {
    communities.value = [];
  }
}
function openExpiringDialog() {
  if (expiringList.value.length === 0) {
    ElMessage.info("暂无即将到期的小区");
    return;
  }
  expiringDialog.value = true;
  // 标记为已读，红点消失
  hasReadExpiring.value = true;
  // 保存已读状态到 localStorage，包含当前数据的哈希值
  const hash = JSON.stringify(expiringList.value.map((c: any) => c._id).sort());
  localStorage.setItem("admin-expiring-read", hash);
}

// 强制修改密码弹窗
const pwdDialog = ref(false);
const pwdForm = reactive({ newPassword: "", confirm: "" });
async function submitPwd() {
  if (!pwdForm.newPassword || !pwdForm.confirm) {
    ElMessage.warning("请填写新密码并确认");
    return;
  }
  if (pwdForm.newPassword !== pwdForm.confirm) {
    ElMessage.error("两次输入的密码不一致");
    return;
  }
  try {
    const raw = localStorage.getItem("admin-user");
    const me = raw ? JSON.parse(raw) : null;
    const uid = me && me._id;
    if (!uid) {
      ElMessage.error("用户信息缺失，请重新登录");
      router.push("/login");
      return;
    }
    const token = localStorage.getItem("admin-token") || "";
    const body = await request.post(`/users/${uid}/change-password`, {
      newPassword: pwdForm.newPassword,
    });

    ElMessage.success("密码已更新，请牢记新密码");
    pwdDialog.value = false;
    pwdForm.newPassword = "";
    pwdForm.confirm = "";
  } catch (e) {
    console.error(e);
    ElMessage.error("修改失败，请稍后重试");
  }
}

onMounted(() => {
  initUser();
  loadExpiring();
  // force change password if flagged by login
  try {
    if (sessionStorage.getItem("mustChangePassword") === "1") {
      sessionStorage.removeItem("mustChangePassword");
      pwdDialog.value = true;
    }
  } catch {}
});
</script>

<style scoped>
.topbar {
  background: #fff;
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
}
.topbar .right {
  display: flex;
  align-items: center;
  gap: 8px;
}
/* 稍微放大顶部栏图标 */
.topbar .el-icon {
  font-size: 20px;
}
.profile-pop {
  font-size: 13px;
}
.profile-pop .row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}
.profile-pop .label {
  color: var(--el-text-color-secondary);
}
.profile-pop .footer {
  text-align: right;
  margin-top: 8px;
}
.admin-layout {
  height: 100%;
  overflow: hidden;
}
.admin-layout :deep(.admin-topbar) {
  display: none !important;
}
.aside {
  background: #001529;
  color: #fff;
}
.logo {
  height: 64px;
  line-height: 64px;
  color: #fff;
  text-align: center;
  font-weight: 600;
}
.el-menu-vertical-demo {
  background: transparent;
  color: #fff;
  border-right: none;
}

.el-menu-vertical-demo .el-menu-item {
  color: #fff !important;
}
.el-menu-vertical-demo .el-menu-item.is-active {
  background: rgba(255, 255, 255, 0.08) !important;
}
/* active menu item font color to blue */
.el-menu-vertical-demo .el-menu-item.is-active,
.el-menu-vertical-demo .el-menu-item.is-active .el-menu-item__content {
  color: #1890ff !important;
}
</style>

<style>
/* 大字号模式 - 全局样式 */
html.large-font {
  font-size: 18px;
}
html.large-font .el-table {
  font-size: 17px !important;
}
html.large-font .el-button {
  font-size: 17px !important;
}
html.large-font .el-form-item__label {
  font-size: 17px !important;
}
html.large-font .el-input__inner {
  font-size: 17px !important;
}
html.large-font .el-menu-item {
  font-size: 17px !important;
}
html.large-font .el-table__header th,
html.large-font .el-table__body td {
  font-size: 17px !important;
}
html.large-font .el-dialog__title {
  font-size: 21px !important;
}
html.large-font .el-card__header {
  font-size: 18px !important;
}
</style>
