<template>
  <div style="height: calc(100vh - 96px); display: flex; flex-direction: column; overflow: hidden;">
    <!-- 搜索筛选 -->
    <el-card style="margin-bottom: 12px; flex-shrink: 0">
      <el-form :inline="true" :model="deviceFilters" class="filter-form">
        <el-form-item label="门禁名称" style="margin-bottom: 0">
          <el-input v-model="deviceFilters.name" placeholder="搜索名称" clearable style="width: 200px" />
        </el-form-item>
        <el-form-item label="门禁编号" style="margin-bottom: 0">
          <el-input v-model="deviceFilters.vendorId" placeholder="搜索编号" clearable style="width: 200px" />
        </el-form-item>
        <el-form-item label="门禁地点" style="margin-bottom: 0">
          <el-input v-model="deviceFilters.location" placeholder="搜索地点" clearable style="width: 200px" />
        </el-form-item>
        <el-form-item style="margin-bottom: 0">
          <el-button type="primary" @click="onDeviceFilter">查询</el-button>
          <el-button @click="onDeviceFilterReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 列表卡片 -->
    <el-card style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <el-button v-if="isSuperAdmin" text style="font-size: 14px;" @click="onBack">
            <el-icon><arrow-left /></el-icon>
            返回小区列表
          </el-button>
          <el-divider v-if="isSuperAdmin" direction="vertical" />
          <span style="font-size: 14px; color: #606266;">
            共 <b style="color: #303133;">{{ filteredDevices.length }}</b> 台设备
          </span>
          <span v-if="isSuperAdmin" style="color: #c0c4cc;">·</span>
          <span v-if="isSuperAdmin" style="font-size: 14px; color: #909399;">{{ communityName }}</span>
        </div>
        <div v-if="isSuperAdmin" style="display: flex; gap: 8px;">
          <el-button type="primary" @click="onCreate">添加门禁</el-button>
          <el-button
            type="danger"
            :disabled="selectedRows.length === 0"
            :loading="batchDeleting"
            @click="onBatchDelete"
          >
            批量删除
            <template v-if="selectedRows.length > 0">({{ selectedRows.length }})</template>
          </el-button>
        </div>
      </div>

      <div style="flex: 1; overflow: hidden;">
        <el-table
          ref="tableRef"
          v-loading="loading"
          :data="pagedDevices"
          stripe
          height="100%"
          @selection-change="onSelectionChange"
        >
          <el-table-column type="selection" width="48" />
          <el-table-column prop="deviceName" label="门禁名称" min-width="140" show-overflow-tooltip />
          <el-table-column prop="vendorId" label="门禁编号" width="140" show-overflow-tooltip />
          <el-table-column prop="locationLabel" label="门禁地点" min-width="160" show-overflow-tooltip />
          <el-table-column label="创建时间" width="170">
            <template #default="{ row }">
              {{ formatTime(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="权限状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.enabled ? 'success' : 'danger'" size="small">
                {{ row.enabled ? "可用" : "不可用" }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="续费时间" width="170">
            <template #default="{ row }">{{ formatTime(row.renewalTime) }}</template>
          </el-table-column>
          <el-table-column label="备注" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ row.remark || "-" }}</template>
          </el-table-column>
          <el-table-column label="操作" :width="isSuperAdmin ? 380 : 300" fixed="right">
            <template #default="{ row }">
              <el-button v-if="isSuperAdmin" size="small" type="danger" :loading="row._deleting" @click="onDelete(row)">
                删除门禁
              </el-button>
              <el-button size="small" type="primary" @click="onEdit(row)">修改信息</el-button>
              <el-button
                size="small"
                :type="row.enabled ? 'warning' : 'success'"
                :loading="row._toggling"
                @click="onToggle(row)"
              >
                {{ row.enabled ? "禁用设备" : "启用设备" }}
              </el-button>
              <el-button size="small" @click="onPermission(row)">单独配置</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div v-if="devices.length > 0" style="display: flex; justify-content: flex-end; margin-top: 12px; flex-shrink: 0;">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :total="devices.length"
          layout="total, sizes, prev, pager, next"
          @size-change="onPageSizeChange"
        />
      </div>
    </el-card>

    <!-- 添加门禁弹窗 -->
    <el-dialog v-model="createDialogVisible" title="添加门禁" width="600px" :close-on-click-modal="false" @closed="resetCreateForm">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="110px">
        <el-form-item label="门禁名称" prop="deviceName">
          <el-input v-model="createForm.deviceName" placeholder="如：西门门禁、1号门" />
        </el-form-item>
        <el-form-item label="门禁类别" prop="locationType">
          <el-radio-group v-model="createForm.locationType" @change="onLocationTypeChange">
            <el-radio value="community_gate">大门门禁</el-radio>
            <el-radio value="unit_gate">单元门禁</el-radio>
          </el-radio-group>
        </el-form-item>
        <!-- 大门门禁：手动填大门名称 -->
        <el-form-item v-if="createForm.locationType === 'community_gate'" label="安装位置" prop="gateName">
          <el-input v-model="createForm.gateName" placeholder="如：西门、南门" />
        </el-form-item>
        <!-- 单元门禁：楼栋单元下拉 -->
        <template v-if="createForm.locationType === 'unit_gate'">
          <el-form-item label="楼栋" prop="building">
            <el-select v-model="createForm.building" style="width: 100%" placeholder="请选择楼栋" @change="onBuildingChange">
              <el-option v-for="b in locationBuildings" :key="b.building" :label="b.buildingName" :value="b.building" />
            </el-select>
          </el-form-item>
          <el-form-item label="单元" prop="unit">
            <el-select v-model="createForm.unit" style="width: 100%" placeholder="请选择单元" :disabled="!createForm.building">
              <el-option v-for="u in availableUnits" :key="u" :label="u" :value="u" />
            </el-select>
          </el-form-item>
        </template>
        <el-divider content-position="left">厂商设备参数</el-divider>
        <el-form-item label="门禁编号" prop="vendorId">
          <el-input v-model="createForm.vendorId" placeholder="如 F20B13CC" />
        </el-form-item>
        <el-form-item label="serial" prop="serial">
          <el-input v-model="createForm.serial" placeholder="设备系列号，如 Gy6aZ" />
        </el-form-item>
        <el-form-item label="password" prop="password">
          <el-input v-model="createForm.password" placeholder="设备密码" />
        </el-form-item>
        <el-form-item label="deviceNo" prop="deviceNo">
          <el-input v-model="createForm.deviceNo" placeholder="出厂编号" />
        </el-form-item>
        <el-form-item label="mac" prop="mac">
          <el-input v-model="createForm.mac" placeholder="MAC地址" />
        </el-form-item>
        <el-form-item label="deviceType" prop="deviceType">
          <el-select v-model="createForm.deviceType" style="width: 100%">
            <el-option label="门禁(1)" :value="1" />
            <el-option label="读头(0)" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="algorithm" prop="algorithm">
          <el-select v-model="createForm.algorithm" style="width: 100%">
            <el-option label="520(1)" :value="1" />
            <el-option label="3288(0)" :value="0" />
            <el-option label="商汤(2)" :value="2" />
            <el-option label="阿里(4)" :value="4" />
            <el-option label="其他(3)" :value="3" />
          </el-select>
        </el-form-item>
        <el-divider content-position="left">续费与备注</el-divider>
        <el-form-item label="续费时间">
          <el-date-picker
            v-model="createForm.renewalTime"
            type="datetime"
            placeholder="选择续费时间（选填）"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DD HH:mm"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="createForm.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入备注（选填）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="createSaving" @click="onCreateSave">
          提交注册
        </el-button>
      </template>
    </el-dialog>

    <!-- 修改信息弹窗 -->
    <el-dialog v-model="editDialogVisible" title="修改门禁信息" width="520px" :close-on-click-modal="false">
      <el-form ref="editFormRef" :model="editForm" label-width="110px">
        <el-form-item label="门禁名称" required>
          <el-input v-model="editForm.deviceName" placeholder="请输入门禁名称" />
        </el-form-item>
        <el-form-item label="门禁地点分类" required>
          <el-select v-model="editForm.locationType" style="width: 100%" @change="onEditLocationTypeChange">
            <el-option label="大门门禁" value="community_gate" />
            <el-option label="单元门禁" value="unit_gate" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editForm.locationType === 'community_gate'" label="大门名称">
          <el-input v-model="editForm.gateName" placeholder="如：西门、南门" />
        </el-form-item>
        <template v-if="editForm.locationType === 'unit_gate'">
          <el-form-item label="楼栋">
            <el-select v-model="editForm.building" style="width: 100%" placeholder="请选择楼栋" @change="onEditBuildingChange">
              <el-option v-for="b in locationBuildings" :key="b.building" :label="b.buildingName" :value="b.building" />
            </el-select>
          </el-form-item>
          <el-form-item label="单元">
            <el-select v-model="editForm.unit" style="width: 100%" placeholder="请选择单元" :disabled="!editForm.building">
              <el-option v-for="u in editAvailableUnits" :key="u" :label="u" :value="u" />
            </el-select>
          </el-form-item>
        </template>
        <el-form-item label="门禁编号">
          <el-input v-model="editForm.vendorId" placeholder="请输入门禁编号" />
        </el-form-item>
        <el-divider content-position="left">续费与备注</el-divider>
        <el-form-item label="续费时间">
          <el-date-picker
            v-model="editForm.renewalTime"
            type="datetime"
            placeholder="选择续费时间（选填）"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DD HH:mm"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="editForm.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入备注（选填）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSaving" @click="onEditSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 权限配置弹窗 -->
    <door-device-permission-dialog
      v-model="permissionDialogVisible"
      :device-id="permissionDeviceId"
      :community-id="communityId"
      :device-name="permissionDeviceName"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { ArrowLeft } from "@element-plus/icons-vue";
import request from "../utils/axios";
import DoorDevicePermissionDialog from "./DoorDevicePermissionDialog.vue";

const props = defineProps<{
  communityId?: string;
  communityName?: string;
  isSuperAdmin?: boolean;
}>();

interface DoorDevice {
  _id: string;
  deviceName: string;
  vendorId?: string;
  vendorDeviceId?: string;
  serial?: string;
  locationType: "community_gate" | "unit_gate";
  locationLabel?: string;
  permissionMode?: string;
  enabled: boolean;
  building?: string;
  unit?: string;
  gateName?: string;
  createdAt?: string;
  mac?: string;
  deviceNo?: string;
  _deleting?: boolean;
  _toggling?: boolean;
}

const router = useRouter();

function getStoredCommunityId(): string {
  try {
    const raw = localStorage.getItem("admin-user");
    if (raw) {
      const u = JSON.parse(raw);
      return u.communityId || "";
    }
  } catch {}
  return "";
}

const communityId = computed(() => props.communityId || getStoredCommunityId());
const communityName = computed(() => props.communityName || "小区门禁");

const devices = ref<DoorDevice[]>([]);
const loading = ref(false);
const batchDeleting = ref(false);
const selectedRows = ref<DoorDevice[]>([]);
const tableRef = ref();

// 设备筛选
const deviceFilters = reactive({ name: "", vendorId: "", location: "" });

const filteredDevices = computed(() => {
  return devices.value.filter((d) => {
    if (deviceFilters.name && !(d.deviceName || "").includes(deviceFilters.name)) return false;
    if (deviceFilters.vendorId && !(d.vendorId || "").includes(deviceFilters.vendorId)) return false;
    if (deviceFilters.location && !(d.locationLabel || "").includes(deviceFilters.location)) return false;
    return true;
  });
});

function onDeviceFilter() { currentPage.value = 1; }
function onDeviceFilterReset() { deviceFilters.name = ""; deviceFilters.vendorId = ""; deviceFilters.location = ""; currentPage.value = 1; }

// 客户端分页
const currentPage = ref(1);
const pageSize = ref(20);

const pagedDevices = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredDevices.value.slice(start, start + pageSize.value);
});

// 添加门禁弹窗
const createDialogVisible = ref(false);
const createSaving = ref(false);
const createFormRef = ref();
const createForm = reactive({
  deviceName: "",
  locationType: "community_gate" as "community_gate" | "unit_gate",
  gateName: "",
  building: "",
  unit: "",
  vendorId: "",
  serial: "",
  password: "",
  deviceNo: "",
  mac: "",
  deviceType: 1,
  algorithm: 1,
  renewalTime: "",
  remark: "",
});
const createRules = {
  deviceName: [{ required: true, message: "请输入门禁名称", trigger: "blur" }],
  locationType: [{ required: true, message: "请选择地点分类", trigger: "change" }],
  vendorId: [{ required: true, message: "请输入门禁编号", trigger: "blur" }],
  serial: [{ required: true, message: "请输入设备系列号", trigger: "blur" }],
  password: [{ required: true, message: "请输入设备密码", trigger: "blur" }],
  deviceNo: [{ required: true, message: "请输入出厂编号", trigger: "blur" }],
  mac: [{ required: true, message: "请输入MAC地址", trigger: "blur" }],
  deviceType: [{ required: true, message: "请选择设备类型", trigger: "change" }],
  algorithm: [{ required: true, message: "请选择算法", trigger: "change" }],
};

// 楼栋单元选项
interface BuildingOption {
  building: string;
  buildingName: string;
  units: string[];
}
const locationBuildings = ref<BuildingOption[]>([]);
const availableUnits = computed(() => {
  if (!createForm.building) return [];
  const found = locationBuildings.value.find((b) => b.building === createForm.building);
  return found ? found.units : [];
});

async function loadLocationOptions() {
  try {
    const res: any = await request.get("/door/location-options", {
      params: { communityId: communityId.value },
    });
    locationBuildings.value = res?.data?.buildings || [];
  } catch {
    locationBuildings.value = [];
  }
}

function onLocationTypeChange() {
  createForm.gateName = "";
  createForm.building = "";
  createForm.unit = "";
}

function onBuildingChange() {
  createForm.unit = "";
}

function resetCreateForm() {
  createForm.deviceName = "";
  createForm.locationType = "community_gate";
  createForm.gateName = "";
  createForm.building = "";
  createForm.unit = "";
  createForm.vendorId = "";
  createForm.serial = "";
  createForm.password = "";
  createForm.deviceNo = "";
  createForm.mac = "";
  createForm.deviceType = 1;
  createForm.algorithm = 1;
  createFormRef.value?.resetFields();
}

async function onCreateSave() {
  const valid = await createFormRef.value?.validate().catch(() => false);
  if (!valid) return;

  createSaving.value = true;
  try {
    const payload: Record<string, any> = {
      communityId: communityId.value,
      deviceName: createForm.deviceName.trim(),
      locationType: createForm.locationType,
      vendorId: createForm.vendorId.trim(),
      serial: createForm.serial.trim(),
      password: createForm.password.trim(),
      deviceNo: createForm.deviceNo.trim(),
      mac: createForm.mac.trim(),
      deviceType: createForm.deviceType,
      algorithm: createForm.algorithm,
    };
    if (createForm.locationType === "community_gate") {
      payload.gateName = createForm.gateName.trim();
    } else {
      payload.building = createForm.building;
      payload.unit = createForm.unit;
    }

    payload.renewalTime = createForm.renewalTime || null;
    payload.remark = createForm.remark || null;

    await request.post("/door/devices/register", payload);
    ElMessage.success("门禁设备注册成功");
    createDialogVisible.value = false;
    await loadDevices();
  } catch (e: any) {
    const data = e?.response?.data || {};
    const fondcardCode = data.fondcardCode;
    let msg: string;
    if (fondcardCode) {
      msg = fondcardErrorMessage(fondcardCode);
    } else if (data.error === "fondcard_not_configured" || data.error === "fondcard_client_init_failed") {
      msg = "厂商接口未配置，请在 admin/.env 中设置 FONDCARD_API_BASE_URL=";
    } else {
      msg = data.detail || data.error || e?.message || "注册失败";
    }
    ElMessage.error(msg);
  } finally {
    createSaving.value = false;
  }
}

// 修改信息弹窗
const editDialogVisible = ref(false);
const editSaving = ref(false);
const editFormRef = ref();
const editingRow = ref<DoorDevice | null>(null);
const editForm = ref({
  deviceName: "",
  locationType: "community_gate" as "community_gate" | "unit_gate",
  gateName: "",
  building: "",
  unit: "",
  vendorId: "",
  renewalTime: "",
  remark: "",
});
const editAvailableUnits = computed(() => {
  if (!editForm.value.building) return [];
  const found = locationBuildings.value.find((b) => b.building === editForm.value.building);
  return found ? found.units : [];
});
function onEditLocationTypeChange() {
  editForm.value.gateName = "";
  editForm.value.building = "";
  editForm.value.unit = "";
}
function onEditBuildingChange() {
  editForm.value.unit = "";
}

// 权限配置弹窗
const permissionDialogVisible = ref(false);
const permissionDeviceId = ref("");
const permissionDeviceName = ref("");

function formatTime(val?: string): string {
  if (!val) return "-";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${h}:${min}`;
  } catch {
    return val;
  }
}

// Fondcard 错误码 → 中文提示映射
function fondcardErrorMessage(code: number): string {
  const map: Record<number, string> = {
    1000: "缺少参数，请检查必填字段是否完整",
    1001: "参数错误，请检查设备参数格式",
    1006: "该设备已在厂商平台注册（设备系列号重复）",
    1012: "设备密码错误，请核实后重试",
    1015: "请求过于频繁，请稍后重试（每秒限10次）",
    1013: "MQTT连接失败，厂商平台暂不可用",
    1014: "设备不在线，请确认设备已通电并联网",
  };
  return map[code] || `厂商接口错误（错误码：${code}），请联系技术支持`;
}

// 权限模式映射
function permissionModeLabel(mode?: string): string {
  const map: Record<string, string> = {
    all_owners: "全部业主可用",
    specified_owners: "指定业主可用",
    none: "未配置",
  };
  return map[mode || "none"] || "未配置";
}

function permissionModeTagType(mode?: string): "success" | "warning" | "info" {
  const map: Record<string, "success" | "warning" | "info"> = {
    all_owners: "success",
    specified_owners: "warning",
    none: "info",
  };
  return map[mode || "none"] || "info";
}

function onBack() {
  if (props.isSuperAdmin) {
    router.push("/admin/door");
  } else {
    router.push("/community-admin");
  }
}

function onCreate() {
  resetCreateForm();
  createDialogVisible.value = true;
}

function onSelectionChange(rows: DoorDevice[]) {
  selectedRows.value = rows;
}

function onPageSizeChange() {
  currentPage.value = 1;
  selectedRows.value = [];
}

// --- 加载设备列表 ---
async function loadDevices() {
  loading.value = true;
  try {
    const params: Record<string, string> = {};
    if (communityId.value) params.communityId = communityId.value;
    const body: any = await request.get("/door/devices", { params });
    devices.value = (body?.data || []).map((d: any) => ({
      ...d,
      _deleting: false,
      _toggling: false,
    }));
    currentPage.value = 1;
  } catch (_e: any) {
    ElMessage.error("加载门禁设备列表失败");
    devices.value = [];
  } finally {
    loading.value = false;
  }
}

// --- 删除 ---
async function onDelete(row: DoorDevice) {
  try {
    await ElMessageBox.confirm(
      `确认删除门禁「${row.deviceName}」？删除后设备将从厂商平台解绑并移除所有相关权限。`,
      "删除确认",
      { type: "warning", confirmButtonText: "确认删除", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  row._deleting = true;
  try {
    await request.delete(`/door/devices/${row._id}`);
    ElMessage.success("门禁已删除");
    await loadDevices();
  } catch (e: any) {
    const msg = e?.response?.data?.error || e?.message || "删除失败";
    ElMessage.error("删除失败：" + msg);
    row._deleting = false;
  }
}

// --- 批量删除 ---
async function onBatchDelete() {
  if (selectedRows.value.length === 0) {
    ElMessage.warning("请先勾选要删除的设备");
    return;
  }
  if (selectedRows.value.length > 50) {
    ElMessage.warning("单次最多批量删除 50 台设备，请减少勾选");
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确认删除选中的 ${selectedRows.value.length} 台设备？删除后将不可恢复。`,
      "批量删除确认",
      { type: "warning", confirmButtonText: "确认删除", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }

  batchDeleting.value = true;
  try {
    const deviceIds = selectedRows.value.map((r) => r._id);
    await request.post("/door/devices/batch-delete", { deviceIds });
    ElMessage.success(`已批量删除 ${deviceIds.length} 台设备`);
    await loadDevices();
  } catch (e: any) {
    const msg = e?.response?.data?.error || e?.message || "批量删除失败";
    ElMessage.error("批量删除失败：" + msg);
  } finally {
    batchDeleting.value = false;
  }
}

// --- 修改信息 ---
function onEdit(row: DoorDevice) {
  editingRow.value = row;
  editForm.value = {
    deviceName: row.deviceName || "",
    locationType: row.locationType || "community_gate",
    gateName: row.gateName || "",
    building: row.building || "",
    unit: row.unit || "",
    vendorId: row.vendorId || "",
    renewalTime: (row as any).renewalTime || "",
    remark: (row as any).remark || "",
  };
  editDialogVisible.value = true;
}

async function onEditSave() {
  if (!editForm.value.deviceName.trim()) {
    ElMessage.warning("请输入门禁名称");
    return;
  }
  if (!editingRow.value) return;

  editSaving.value = true;
  try {
    await request.put(`/door/devices/${editingRow.value._id}`, {
      deviceName: editForm.value.deviceName.trim(),
      locationType: editForm.value.locationType,
      gateName: editForm.value.gateName.trim(),
      building: editForm.value.building,
      unit: editForm.value.unit,
      vendorId: editForm.value.vendorId.trim(),
      renewalTime: editForm.value.renewalTime || null,
      remark: editForm.value.remark || null,
    });
    ElMessage.success("门禁信息已更新");
    editDialogVisible.value = false;
    await loadDevices();
  } catch (e: any) {
    const msg = e?.response?.data?.error || e?.message || "更新失败";
    ElMessage.error("更新失败：" + msg);
  } finally {
    editSaving.value = false;
  }
}

// --- 启用/禁用 ---
async function onToggle(row: DoorDevice) {
  const action = row.enabled ? "禁用" : "启用";
  try {
    await ElMessageBox.confirm(
      `确认${action}门禁「${row.deviceName}」？`,
      `${action}确认`,
      { type: "warning", confirmButtonText: `确认${action}`, cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  row._toggling = true;
  try {
    const newEnabled = !row.enabled;
    await request.patch(`/door/devices/${row._id}/toggle`, { enabled: newEnabled });
    row.enabled = newEnabled;
    ElMessage.success(`门禁已${action}`);
  } catch (e: any) {
    const msg = e?.response?.data?.error || e?.message || "操作失败";
    ElMessage.error(`${action}失败：` + msg);
  } finally {
    row._toggling = false;
  }
}

// --- 权限配置 ---
function onPermission(row: DoorDevice) {
  permissionDeviceId.value = row._id;
  permissionDeviceName.value = row.deviceName || "";
  permissionDialogVisible.value = true;
}

onMounted(() => {
  if (!communityId.value) {
    ElMessage.error("缺少小区ID参数，即将返回列表");
    if (props.isSuperAdmin) {
      router.replace("/admin/door");
    }
    return;
  }
  loadLocationOptions();
  loadDevices();
});
</script>

<style scoped>
.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
}
.filter-form :deep(.el-form-item) {
  margin-right: 16px;
}
</style>
