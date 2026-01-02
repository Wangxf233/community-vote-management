<template>
  <div
    style="
      height: calc(100vh - 96px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    "
  >
    <!-- 顶部工具栏（纯图标） -->
    <div class="admin-topbar" style="flex-shrink: 0">
      <div class="left"></div>
      <div class="right">
        <el-tooltip content="刷新" placement="bottom">
          <el-button text circle @click="refresh">
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
          :content="isDark ? '切换到日间模式' : '切换到夜间模式'"
          placement="bottom"
        >
          <el-button text circle @click="toggleDark" class="topbar-item">
            <el-icon v-if="!isDark"><Moon /></el-icon>
            <el-icon v-else><Sunny /></el-icon>
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
    </div>
    <el-card style="margin-bottom: 12px; flex-shrink: 0">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="省/市/区">
          <el-cascader
            v-model="filters.region"
            :options="regionOptions"
            clearable
          />
        </el-form-item>
        <el-form-item label="小区名称">
          <el-input v-model="filters.name" placeholder="小区名称" />
        </el-form-item>
        <el-form-item label="负责人">
          <el-input v-model="filters.ownerName" placeholder="负责姓名" />
        </el-form-item>
        <el-form-item label="联系方式">
          <el-input v-model="filters.ownerPhone" placeholder="手机号" />
        </el-form-item>
        <el-form-item label="开通时间范围">
          <el-date-picker
            v-model="filters.startRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onQuery">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card
      style="flex: 1; display: flex; flex-direction: column; overflow: hidden"
    >
      <div
        style="
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        "
      >
        <div>小区列表（共 {{ total }} 条）</div>
      </div>
      <div style="flex: 1; width: 100%; overflow: hidden">
        <el-table :data="communities" stripe style="width: 100%" height="100%">
          <el-table-column
            label="小区名称"
            prop="name"
            width="220"
            align="center"
          />
          <el-table-column label="省" width="120" align="center">
            <template #default="{ row }">{{
              row.region && row.region[0] ? row.region[0] : ""
            }}</template></el-table-column
          >
          <el-table-column label="市" width="120" align="center">
            <template #default="{ row }">{{
              row.region && row.region[1] ? row.region[1] : ""
            }}</template></el-table-column
          >
          <el-table-column label="区" width="120" align="center">
            <template #default="{ row }">{{
              row.region && row.region[2] ? row.region[2] : ""
            }}</template></el-table-column
          >
          <el-table-column
            label="负责人"
            prop="ownerName"
            width="130"
            align="center"
          />
          <el-table-column
            label="联系方式"
            prop="ownerPhone"
            min-width="160"
            align="center"
          />
          <el-table-column label="开通时间" width="160" align="center">
            <template #header>
              <span class="sortable-header">
                开通时间
                <el-button
                  class="sort-btn"
                  type="text"
                  @click="toggleSort('productStart')"
                  >{{
                    sortField === "productStart"
                      ? sortOrder === "asc"
                        ? "↑"
                        : "↓"
                      : "↕"
                  }}</el-button
                >
              </span>
            </template>
            <template #default="{ row }">{{
              formatDate(getStart(row))
            }}</template>
          </el-table-column>
          <el-table-column label="到期时间" width="160" align="center">
            <template #header>
              <span class="sortable-header">
                到期时间
                <el-button
                  class="sort-btn"
                  type="text"
                  @click="toggleSort('productEnd')"
                  >{{
                    sortField === "productEnd"
                      ? sortOrder === "asc"
                        ? "↑"
                        : "↓"
                      : "↕"
                  }}</el-button
                >
              </span>
            </template>
            <template #default="{ row }">{{
              formatDate(getEnd(row))
            }}</template>
          </el-table-column>
          <el-table-column label="有效期(天)" width="140" align="center">
            <template #header>
              <span class="sortable-header">
                有效期(天)
                <el-button
                  class="sort-btn"
                  type="text"
                  @click="toggleSort('remainingDays')"
                  >{{
                    sortField === "remainingDays"
                      ? sortOrder === "asc"
                        ? "↑"
                        : "↓"
                      : "↕"
                  }}</el-button
                >
              </span>
            </template>
            <template #default="{ row }">{{ computeDays(row) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="240" align="center">
            <template #default="{ row }">
              <el-button type="primary" size="mini" @click="onViewAdmin(row)"
                >查看账号</el-button
              >
              <el-button type="danger" size="mini" @click="onDelete(row)"
                >删除</el-button
              >
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>
    <el-dialog
      v-model="expiringDialog"
      title="有效期不足30天的小区"
      width="640px"
    >
      <el-table :data="expiringList" size="small" style="width: 100%">
        <el-table-column label="小区名称" prop="name" />
        <el-table-column label="到期时间" width="160">
          <template #default="{ row }">{{ formatDate(getEnd(row)) }}</template>
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

    <el-dialog
      v-model="adminDialog"
      title="总管理员账号"
      width="520px"
      :lock-scroll="false"
    >
      <el-form :model="adminForm" label-width="140px" class="dialog-center">
        <el-form-item label="账号">
          <el-input v-model="adminForm.username" class="dialog-input" />
        </el-form-item>
        <el-form-item label="密码">
          <template v-if="tempNewPassword">
            <el-input :value="tempNewPassword" readonly class="dialog-input" />
            <div class="hint warn">请保存密码，只允许查看一次。</div>
          </template>
          <template v-else>
            <el-input value="********" disabled class="dialog-input" />
            <div class="hint">出于安全考虑，当前密码不可见。</div>
          </template>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-space>
          <el-button type="warning" @click="onResetAdmin">重置密码</el-button>
          <el-button type="primary" @click="onSaveUsername">保存账号</el-button>
        </el-space>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Refresh, Bell, Moon, Sunny, User } from "@element-plus/icons-vue";
import request from "@/utils/axios";
const filters = reactive({
  region: [] as string[],
  name: "",
  ownerName: "",
  ownerPhone: "",
  startRange: [] as any[],
});
const regionOptions = ref([
  {
    value: "广东省",
    label: "广东省",
    children: [
      {
        value: "深圳市",
        label: "深圳市",
        children: [
          { value: "南山区", label: "南山区" },
          { value: "福田区", label: "福田区" },
        ],
      },
    ],
  },
] as any);

const communities = ref<any[]>([]);
const total = ref(0);
const adminDialog = ref(false);
const adminForm = reactive({ username: "" });
const tempNewPassword = ref<string | null>(null);
let currentCommunityId: string | null = null;
// 顶部栏状态
const isDark = ref(false);
const username = ref("");
const account = ref("");
const expiringDialog = ref(false);
const expiringList = computed(() => {
  // 小于等于30天的（含已到期）
  return (communities.value || []).filter((c) => {
    const d = computeDays(c);
    const n = typeof d === "number" ? d : d === "已到期" ? 0 : 99999;
    return n <= 30;
  });
});
const expiringCount = computed(() => expiringList.value.length);

function openExpiringDialog() {
  if (expiringCount.value === 0) {
    ElMessage.info("暂无即将到期的小区");
    return;
  }
  expiringDialog.value = true;
}

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
function initUser() {
  try {
    const raw = localStorage.getItem("admin-user");
    if (raw) {
      const u = JSON.parse(raw);
      username.value = u?.username || u?.nickName || "管理员";
      account.value = u?.username || u?.phone || "";
    }
  } catch (_) {}
  const dark = localStorage.getItem("admin-dark") === "1";
  applyDark(dark);
}

function refresh() {
  load();
}

function logout() {
  localStorage.removeItem("admin-token");
  localStorage.removeItem("admin-user");
  window.location.href = "/#/login";
}

async function onViewAdmin(row: any) {
  try {
    currentCommunityId = row._id;
    const body = await request.get(`/communities/${row._id}/admin-account`, {
      params: { t: Date.now() },
    });
    // 优先使用接口 username；若为空再兜底使用行数据中的 adminUsername（如接口受缓存/权限影响）
    adminForm.username = body.username || row.adminUsername || "";
    // 初次查看不展示密码明文
    tempNewPassword.value = null;
    adminDialog.value = true;
  } catch (e) {
    console.error(e);
    ElMessage.error("加载失败");
  }
}
async function onSaveUsername() {
  if (!currentCommunityId) return;
  if (!adminForm.username) {
    ElMessage.warning("请填写账号");
    return;
  }
  try {
    const body = await request.put(
      `/communities/${currentCommunityId}/admin-account`,
      {
        username: adminForm.username.trim(),
        ...(tempNewPassword.value
          ? { newPassword: String(tempNewPassword.value) }
          : {}),
      }
    );
    // 如果后端返回了新密码（如首次创建时），在弹窗中显示一次
    if (body.newPassword) {
      tempNewPassword.value = body.newPassword;
    }
    ElMessage.success("账号/密码已保存");
  } catch (e) {
    console.error(e);
    ElMessage.error("保存账号失败");
  }
}

async function onResetAdmin() {
  if (!currentCommunityId) return;
  try {
    await ElMessageBox.confirm(
      "将为该小区总管理员生成一个新密码。本次重置后无需强制修改密码。是否继续？",
      "重置密码确认",
      { type: "warning" }
    );
  } catch (_) {
    return; // 用户取消
  }
  try {
    // 生成8位纯数字密码
    const gen8Digit = () =>
      String(Math.floor(10000000 + Math.random() * 90000000));
    const nextPwd = gen8Digit();
    const body = await request.put(
      `/communities/${currentCommunityId}/admin-account`,
      {
        // 带上已知账号更稳妥；若为空，后端会从 community 文档回退
        ...(adminForm.username && adminForm.username.trim()
          ? { username: adminForm.username.trim() }
          : {}),
        reset: true,
        newPassword: nextPwd,
      }
    );
    const newPwd = body.newPassword || nextPwd;
    tempNewPassword.value = newPwd; // 在弹窗内一次性展示
    ElMessage.success("密码已重置，请及时保存");
    load();
  } catch (e) {
    console.error(e);
    ElMessage.error("重置失败");
  }
}
const page = ref(1);
const pageSize = ref(50);
const sortField = ref("productStart");
const sortOrder = ref("desc");

function toTimestamp(val: any): number | null {
  if (!val) return null;
  try {
    // 支持 Date | 字符串 | 数字（秒/毫秒）
    if (val instanceof Date) return val.getTime();
    if (typeof val === "number") {
      // 小于 10^12 视为秒
      return val < 1e12 ? val * 1000 : val;
    }
    if (typeof val === "string") return new Date(val).getTime();
    // 兼容形如 { $date: 1699999999999 } 的结构
    if (val && typeof val === "object" && (val.$date || val.date)) {
      const v = val.$date || val.date;
      return toTimestamp(v);
    }
  } catch (_) {
    /* ignore */
  }
  return null;
}

function formatDate(v: any) {
  const ts = toTimestamp(v);
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleDateString();
  } catch (e) {
    return "";
  }
}

function getStart(row: any) {
  return (
    row?.productStart ?? row?.startDate ?? row?.product_start ?? row?.start
  );
}
function getEnd(row: any) {
  return row?.productEnd ?? row?.endDate ?? row?.product_end ?? row?.end;
}

function computeDays(row: any) {
  const s = toTimestamp(getStart(row));
  const e = toTimestamp(getEnd(row));
  if (!s || !e) return "-";
  try {
    const days = Math.ceil((e - s) / (24 * 3600 * 1000));
    if (days <= 0) return "已到期";
    return days;
  } catch (e) {
    return "-";
  }
}

async function load() {
  try {
    const params: any = {
      page: page.value,
      pageSize: pageSize.value,
      sortField: sortField.value,
      sortOrder: sortOrder.value,
    };
    if (filters.name) params.name = filters.name;
    if (filters.ownerName) params.ownerName = filters.ownerName;
    if (filters.ownerPhone) params.ownerPhone = filters.ownerPhone;
    if (filters.region && filters.region.length)
      params.region = JSON.stringify(filters.region);
    if (filters.startRange && filters.startRange.length === 2) {
      params.startFrom = new Date(filters.startRange[0]).toISOString();
      params.startTo = new Date(filters.startRange[1]).toISOString();
    }

    const body = await request.get("/communities", { params });
    communities.value = body.data || body;
    total.value = body.total || (Array.isArray(body) ? body.length : 0);

    // 客户端排序：当选择按有效期(天)排序时，基于 computeDays 的结果本地排序
    if (sortField.value === "remainingDays") {
      const dir = sortOrder.value === "asc" ? 1 : -1;
      communities.value = (communities.value || [])
        .slice()
        .sort((a: any, b: any) => {
          const da = Number(computeDays(a)) || 0;
          const db = Number(computeDays(b)) || 0;
          return (da - db) * dir;
        });
    }
  } catch (e) {
    console.error(e);
    communities.value = [];
  }
}

function onQuery() {
  page.value = 1;
  load();
}

function onReset() {
  filters.region = [];
  filters.name = "";
  filters.ownerName = "";
  filters.ownerPhone = "";
  filters.startRange = [];
  load();
}

function toggleSort(field: string) {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
  } else {
    sortField.value = field;
    sortOrder.value = "desc";
  }
  load();
}

async function onDelete(row: any) {
  try {
    await ElMessageBox.confirm(
      `确认删除小区「${row.name}」？此操作不可撤销。`,
      "删除确认",
      {
        type: "warning",
        confirmButtonText: "确认删除",
        cancelButtonText: "取消",
      }
    );
  } catch (_) {
    return; // 用户取消
  }
  try {
    await request.delete(`/communities/${row._id}`);
    ElMessage.success("删除成功");
    load();
  } catch (e) {
    console.error("删除异常:", e);
    ElMessage.error("删除失败，请稍后重试");
  }
}

onMounted(() => {
  initUser();
  // 跳转后展示登录成功提示
  if (sessionStorage.getItem("loginJust") === "1") {
    sessionStorage.removeItem("loginJust");
    ElMessage.success({ message: "登录成功", duration: 2000 });
  }
  load();
});
</script>

<style scoped>
.admin-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  margin-bottom: 12px;
}
.admin-topbar .left {
  font-weight: 600;
}
.admin-topbar .right {
  display: flex;
  align-items: center;
  gap: 8px;
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
.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.sortable-header {
  display: inline-flex;
  align-items: baseline;
}
.sort-btn {
  font-size: 16px;
  line-height: 1;
  padding: 0 4px;
  margin-left: 6px;
}
.hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-left: 8px;
}
.hint.warn {
  color: var(--el-color-warning);
}
.dialog-center {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px 0 0 0; /* 上下增加内边距实现垂直居中效果 */
}
.dialog-center :deep(.el-form) {
  display: flex;
  flex-direction: column;
  align-items: center; /* 让整个表单水平居中 */
}
.dialog-center :deep(.el-form-item) {
  margin-bottom: 24px; /* 增加行间距 */
  width: 100%;
  max-width: 460px; /* 限制每行的最大宽度 */
  display: flex;
  justify-content: center;
}
.dialog-center :deep(.el-form-item__label) {
  text-align: right;
  width: 80px !important;
  padding-right: 12px;
}
.dialog-center :deep(.el-form-item__content) {
  flex: 1;
  max-width: 320px;
}
.dialog-input {
  width: 100%;
}
</style>
