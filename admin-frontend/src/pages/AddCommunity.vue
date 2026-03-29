<template>
  <div>
    <div class="admin-topbar">
      <div class="left"></div>
      <div class="right">
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
    <el-card>
      <h3>添加小区</h3>
      <el-form :model="form" :rules="rules" ref="formRef" label-width="160px">
        <el-form-item label="省/市/区" prop="region">
          <el-cascader
            v-model="form.region"
            :options="regionOptions"
            clearable
          />
        </el-form-item>
        <el-form-item label="详细地址" prop="address">
          <el-input
            v-model="form.address"
            placeholder="输入街道等详细地址信息"
          />
        </el-form-item>
        <el-form-item label="小区名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="负责人姓名" prop="ownerName">
          <el-input v-model="form.ownerName" />
        </el-form-item>
        <el-form-item label="负责人联系方式" prop="ownerPhone">
          <el-input v-model="form.ownerPhone" />
        </el-form-item>
        <el-form-item label="开通时间" prop="startDate">
          <el-date-picker
            v-model="form.startDate"
            type="date"
            placeholder="开通日期"
          />
        </el-form-item>
        <el-form-item label="有效期/到期时间" prop="endDate">
          <div style="display: flex; align-items: center; gap: 12px">
            <el-select
              v-model="period"
              placeholder="选择年限"
              style="width: 160px"
              @change="onPeriodChange"
            >
              <el-option label="1年" :value="1" />
              <el-option label="2年" :value="2" />
              <el-option label="3年" :value="3" />
            </el-select>
            <div style="display: flex; align-items: center; gap: 8px">
              <div>或直接选择到期时间：</div>
              <el-date-picker
                v-model="form.endDate"
                type="date"
                placeholder="到期日期"
                @change="onEndDatePick"
              />
            </div>
          </div>
          <div style="margin-top: 8px">当前到期时间：{{ endDateDisplay }}</div>
        </el-form-item>
        <el-form-item label="默认总管理员账号" prop="defaultAdminUsername">
          <el-input
            v-model="form.defaultAdminUsername"
            placeholder="设置该小区的总管理员账号"
          />
        </el-form-item>
        <el-form-item label="默认总管理员密码" prop="defaultAdminPassword">
          <el-input
            v-model="form.defaultAdminPassword"
            :type="showPassword ? 'text' : 'password'"
            placeholder="设置初始密码（首次登录将强制修改）"
          >
            <template #suffix>
              <el-icon
                @click="showPassword = !showPassword"
                style="cursor: pointer"
              >
                <View v-if="!showPassword" />
                <Hide v-if="showPassword" />
              </el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onCreate">创建</el-button>
          <el-button type="default" @click="onReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
    <el-dialog
      v-model="expiringDialog"
      title="有效期不足30天的小区"
      width="640px"
    >
      <el-table :data="expiringList" size="small" style="width: 100%">
        <el-table-column label="小区名称" prop="name" />
        <el-table-column label="到期时间" width="160">
          <template #default="{ row }">{{
            formatDate(row.endDate || row.productEnd)
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
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Bell, Moon, Sunny, User, View, Hide } from "@element-plus/icons-vue";
import request from "@/utils/axios";

const showPassword = ref(false);
const today = new Date();
const form = reactive({
  region: [] as string[],
  address: "",
  name: "",
  ownerName: "",
  ownerPhone: "",
  startDate: today,
  endDate: null as Date | null,
  defaultAdminUsername: "",
  defaultAdminPassword: "",
});
const period = ref<number | null>(1);
const formRef = ref();
const rules = reactive({
  region: [
    { required: true, message: "请选择省/市/区", trigger: "change" },
    {
      validator: (_: any, val: any[], cb: any) => {
        if (!val || val.length === 0) return cb(new Error("请选择省/市/区"));
        cb();
      },
      trigger: "change",
    },
  ],
  address: [{ required: true, message: "请填写详细地址", trigger: "blur" }],
  name: [{ required: true, message: "请填写小区名称", trigger: "blur" }],
  ownerName: [{ required: true, message: "请填写负责人姓名", trigger: "blur" }],
  ownerPhone: [
    { required: true, message: "请填写负责人联系方式", trigger: "blur" },
    {
      validator: (_: any, val: string, cb: any) => {
        if (!val) return cb();
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!phoneRegex.test(val)) {
          return cb(new Error("请输入正确的手机号码"));
        }
        cb();
      },
      trigger: ["blur", "change"],
    },
  ],
  startDate: [{ required: true, message: "请选择开通时间", trigger: "change" }],
  endDate: [{ required: true, message: "请选择到期时间", trigger: "change" }],
  defaultAdminUsername: [
    { required: true, message: "请填写默认总管理员账号", trigger: "blur" },
    {
      validator: (_: any, val: string, cb: any) => {
        if (!val) return cb();
        const ok = /^[A-Za-z0-9_]{4,32}$/.test(val);
        if (!ok) return cb(new Error("账号需为4-32位字母、数字或下划线"));
        if (/^\d+$/.test(val)) return cb(new Error("账号不能全为数字"));
        cb();
      },
      trigger: ["blur", "change"],
    },
  ],
  defaultAdminPassword: [
    { required: true, message: "请填写默认总管理员密码", trigger: "blur" },
  ],
});

const regionOptions = ref([]);

function computeEndDate() {
  const s = form.startDate ? new Date(form.startDate) : new Date();
  const years = period.value || null;
  if (years) {
    const d = new Date(s.getTime());
    d.setFullYear(d.getFullYear() + years);
    form.endDate = d;
  }
}

function onPeriodChange() {
  // when period selected, compute endDate from startDate
  computeEndDate();
}

function onEndDatePick() {
  // when user picks end date manually, clear period selection to indicate custom
  period.value = null;
}

const endDateDisplay = computed(() => {
  return form.endDate ? new Date(form.endDate).toLocaleDateString() : "-";
});

// 通用日期工具
function toTimestamp(val: any): number | null {
  if (!val) return null;
  try {
    if (val instanceof Date) return val.getTime();
    if (typeof val === "number") return val < 1e12 ? val * 1000 : val;
    if (typeof val === "string") return new Date(val).getTime();
    if (val && typeof val === "object" && (val.$date || val.date)) {
      const v = val.$date || val.date;
      return toTimestamp(v);
    }
  } catch (_) {}
  return null;
}
function getStart(row: any) {
  return (
    row?.productStart ?? row?.startDate ?? row?.product_start ?? row?.start
  );
}
function getEnd(row: any) {
  return row?.productEnd ?? row?.endDate ?? row?.product_end ?? row?.end;
}
function formatDate(v: any) {
  const ts = toTimestamp(v);
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleDateString();
  } catch {
    return "";
  }
}
function computeDays(row: any) {
  const s = toTimestamp(getStart(row));
  const e = toTimestamp(getEnd(row));
  if (!s || !e) return "-";
  const days = Math.ceil((e - s) / (24 * 3600 * 1000));
  if (days <= 0) return "已到期";
  return days;
}

async function onCreate() {
  // 统一表单验证
  const ok = await new Promise<boolean>((resolve) => {
    (formRef.value as any)?.validate((valid: boolean) => resolve(valid));
  });
  if (!ok) {
    ElMessage.warning("请填写完整所有必填项");
    return;
  }
  const token = localStorage.getItem("admin-token") || "";
  if (!token) {
    ElMessageBox.alert(
      "尚未检测到登录凭证，请先登录。点击确定跳转到登录页。",
      "未登录",
      { confirmButtonText: "去登录" },
    ).then(() => {
      window.location.href = "/#/login";
    });
    return;
  }
  try {
    const payload: any = {
      name: form.name,
      region: form.region,
      address: form.address || "",
      ownerName: form.ownerName,
      ownerPhone: form.ownerPhone,
      startDate: form.startDate
        ? new Date(form.startDate).toISOString()
        : undefined,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
      defaultAdmin:
        form.defaultAdminUsername && form.defaultAdminPassword
          ? {
              username: form.defaultAdminUsername.trim(),
              password: form.defaultAdminPassword,
            }
          : undefined,
    };

    const body = await request.post("/communities", payload);
    ElMessage.success("创建成功");
    onReset();
  } catch (e) {
    console.error(e);
    ElMessage.error(
      "创建失败: " + (e && (e as any).message ? (e as any).message : e),
    );
  }
}

function onReset() {
  form.name = "";
  form.region = [];
  form.address = "";
  form.ownerName = "";
  form.ownerPhone = "";
  form.startDate = new Date();
  period.value = 1;
  computeEndDate();
  form.defaultAdminUsername = "";
  form.defaultAdminPassword = "";
  // 清除表单验证状态
  formRef.value?.clearValidate();
}

// init
computeEndDate();

// 顶部栏与提醒逻辑（与列表页共享简化版）
const isDark = ref(false);
const username = ref("");
const account = ref("");
const expiringDialog = ref(false);
const expiringList = ref<any[]>([]);
const expiringCount = computed(() => expiringList.value.length);
async function refreshExpiring() {
  // 仅在本页面简单调用后端，以最少字段获取即将到期小区
  // 这里复用 /api/communities 接口，拉取前50条并筛选。
  try {
    const body = await request.get("/communities", {
      params: { page: 1, pageSize: 50 },
    });
    const arr = body.data || body || [];
    expiringList.value = arr.filter((c: any) => {
      const d = computeDays(c);
      const n = typeof d === "number" ? d : d === "已到期" ? 0 : 99999;
      return n <= 30;
    });
  } catch (error) {
    // 静默失败
  }
}
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

async function loadRegions() {
  try {
    const data: any = await request.get("/regions");
    regionOptions.value = data || [];
  } catch (e) {
    console.error("加载省市区数据失败:", e);
    regionOptions.value = [];
  }
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
  loadRegions();
  refreshExpiring();
}
function logout() {
  localStorage.removeItem("admin-token");
  localStorage.removeItem("admin-user");
  window.location.href = "/#/login";
}
onMounted(initUser);
</script>

<style scoped>
.el-form :deep(.no-asterisk) .el-form-item__label::before {
  content: none !important;
}
.el-form :deep(.el-form-item__label) {
  white-space: nowrap;
}
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
.btn-text {
  margin-left: 6px;
}
.user-entry {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
/* keep simple */
</style>
