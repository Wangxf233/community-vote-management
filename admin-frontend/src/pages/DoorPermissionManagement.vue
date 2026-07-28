<template>
  <div style="padding: 0">
    <!-- 搜索过滤 + 批量操作 -->
    <el-card style="margin-bottom: 12px">
      <el-form :inline="true" :model="filters">
        <el-form-item label="姓名">
          <el-input
            v-model="filters.name"
            placeholder="姓名"
            clearable
            style="width: 130px"
          />
        </el-form-item>
        <el-form-item label="楼栋">
          <el-select
            v-model="filters.building"
            placeholder="全部楼栋"
            clearable
            style="width: 120px"
          >
            <el-option
              v-for="b in buildingOptions"
              :key="b"
              :label="b"
              :value="b"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="单元">
          <el-select
            v-model="filters.unit"
            placeholder="全部单元"
            clearable
            :disabled="!filters.building"
            style="width: 120px"
          >
            <el-option
              v-for="u in unitOptions"
              :key="u"
              :label="u"
              :value="u"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="开门权限">
          <el-select
            v-model="filters.doorStatus"
            placeholder="全部"
            clearable
            style="width: 110px"
          >
            <el-option label="已开通" value="enabled" />
            <el-option label="未开通" value="disabled" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSearch">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 数据表格 -->
    <el-card>
      <div style="display: flex; gap: 8px; margin-bottom: 12px">
        <el-button
          type="primary"
          :disabled="!hasUnenabledSelected"
          :loading="batchLoading"
          @click="batchEnable"
          >批量开通</el-button
        >
        <el-button
          type="danger"
          :disabled="!hasEnabledSelected"
          :loading="batchLoading"
          @click="batchDisable"
          >批量取消开通</el-button
        >
      </div>

      <el-table
        v-loading="loading"
        :data="pagedList"
        style="width: 100%"
        stripe
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="44" />
        <el-table-column label="姓名" prop="name" min-width="90" />
        <el-table-column
          label="楼栋"
          prop="building"
          width="75"
          align="center"
        />
        <el-table-column label="单元" prop="unit" width="75" align="center" />
        <el-table-column label="房号" prop="room" width="75" align="center" />
        <el-table-column label="手机号" prop="phone" width="130" />
        <el-table-column label="开门权限" width="95" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.doorAccessEnabled ? 'success' : 'info'"
              size="small"
            >
              {{ row.doorAccessEnabled ? "已开通" : "未开通" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="可开门的设备名称" min-width="160">
          <template #default="{ row }">
            {{ getApplicableDeviceNames(row) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" align="center" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="!row.doorAccessEnabled"
              type="primary"
              size="small"
              :loading="row._loading"
              @click="onEnable(row)"
              >开通</el-button
            >
            <el-button
              v-else
              type="danger"
              size="small"
              :loading="row._loading"
              @click="onDisable(row)"
              >取消开通</el-button
            >
          </template>
        </el-table-column>
      </el-table>

      <div
        v-if="!loading && filteredList.length === 0"
        style="text-align: center; color: #999; padding: 32px 0"
      >
        暂无认证通过的业主
      </div>

      <div
        v-if="filteredList.length > 0"
        style="display: flex; justify-content: flex-end; margin-top: 12px"
      >
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[20, 50, 100]"
          :total="filteredList.length"
          layout="total, sizes, prev, pager, next"
          @current-change="onPageChange"
          @size-change="onSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import request from "../utils/axios";

const props = defineProps<{
  communityId?: string;
}>();

const loading = ref(false);
const batchLoading = ref(false);
const list = ref<any[]>([]);
const devices = ref<any[]>([]);
const selectedRows = ref<any[]>([]);

const page = ref(1);
const pageSize = ref(50);

const filters = reactive({
  name: "",
  building: "",
  unit: "",
  doorStatus: "",
});

// 楼栋选项从认证列表动态提取
const buildingOptions = computed(() => {
  const buildings = list.value.map((c) => c.building).filter(Boolean);
  return [...new Set(buildings)].sort();
});

// 单元选项依赖已选楼栋
const unitOptions = computed(() => {
  if (!filters.building) return [];
  const units = list.value
    .filter((c) => c.building === filters.building)
    .map((c) => c.unit)
    .filter(Boolean);
  return [...new Set(units)].sort();
});

// 楼栋变更时清空单元
watch(
  () => filters.building,
  () => {
    filters.unit = "";
  },
);

const filteredList = computed(() => {
  return list.value.filter((item) => {
    if (filters.name && !item.name?.includes(filters.name)) return false;
    if (filters.building && item.building !== filters.building) return false;
    if (filters.unit && item.unit !== filters.unit) return false;
    if (filters.doorStatus === "enabled" && !item.doorAccessEnabled)
      return false;
    if (filters.doorStatus === "disabled" && item.doorAccessEnabled)
      return false;
    return true;
  });
});

const pagedList = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filteredList.value.slice(start, start + pageSize.value);
});

const hasUnenabledSelected = computed(() =>
  selectedRows.value.some((r) => !r.doorAccessEnabled),
);
const hasEnabledSelected = computed(() =>
  selectedRows.value.some((r) => r.doorAccessEnabled),
);

function resetFilters() {
  filters.name = "";
  filters.building = "";
  filters.unit = "";
  filters.doorStatus = "";
  page.value = 1;
}

function onSearch() {
  page.value = 1;
  selectedRows.value = [];
}

function onPageChange() {
  selectedRows.value = [];
}

function onSizeChange() {
  page.value = 1;
  selectedRows.value = [];
}

function onSelectionChange(rows: any[]) {
  selectedRows.value = rows;
}

// 归一化楼栋/单元号（去掉文字，只保留数字）
function normalizeNo(value: any): string {
  if (value === undefined || value === null) return "";
  const str = String(value).trim();
  if (!str) return "";
  const digits = str.match(/\d+/g);
  if (!digits || !digits.length) return str;
  return String(parseInt(digits.join(""), 10));
}

// 计算每位业主可开的设备名称
function getApplicableDeviceNames(cert: any): string {
  if (!cert.doorAccessEnabled) return "—";
  const certKey = `${normalizeNo(cert.building)}#${normalizeNo(cert.unit)}`;
  const names = devices.value
    .filter((d: any) => {
      if (d.locationType === "community_gate") return true;
      if (d.locationType === "unit_gate") {
        const dk = `${normalizeNo(d.building)}#${normalizeNo(d.unit)}`;
        return certKey && dk === certKey;
      }
      return false;
    })
    .map((d: any) => d.deviceName || d.serial);
  return names.length ? names.join("、") : "—";
}

async function load() {
  loading.value = true;
  page.value = 1;
  selectedRows.value = [];
  try {
    const params: Record<string, string> = { pageSize: "500" };
    if (props.communityId) params.communityId = props.communityId;
    const res: any = await request.get("/door/owner-permissions", { params });
    list.value = (res.data || []).map((item: any) => ({
      ...item,
      _loading: false,
    }));
  } catch (e: any) {
    ElMessage.error("加载失败：" + (e?.message || "未知错误"));
  } finally {
    loading.value = false;
  }
}

async function loadDevices() {
  try {
    const params: Record<string, string> = {};
    if (props.communityId) params.communityId = props.communityId;
    const res: any = await request.get("/door/devices", { params });
    devices.value = res.data || [];
  } catch (e) {
    console.error("load devices failed:", e);
  }
}

async function onEnable(row: any) {
  try {
    await ElMessageBox.confirm(
      `确认为「${row.name}」开通门禁权限？`,
      "开通确认",
      {
        type: "info",
        confirmButtonText: "确认开通",
        cancelButtonText: "取消",
      },
    );
  } catch {
    return;
  }
  row._loading = true;
  try {
    await request.post(`/door/owner-permissions/${row._id}/enable`);
    row.doorAccessEnabled = true;
    ElMessage.success("门禁权限已开通");
  } catch (e: any) {
    const msg = e?.response?.data?.error || e?.message || "开通失败";
    ElMessage.error(
      msg === "already_enabled" ? "该业主门禁权限已开通" : "开通失败：" + msg,
    );
  } finally {
    row._loading = false;
  }
}

async function onDisable(row: any) {
  try {
    await ElMessageBox.confirm(
      `确认取消「${row.name}」的门禁权限？取消后该业主将立即无法进出。`,
      "取消开通确认",
      {
        type: "warning",
        confirmButtonText: "确认取消",
        cancelButtonText: "取消",
      },
    );
  } catch {
    return;
  }
  row._loading = true;
  try {
    await request.post(`/door/owner-permissions/${row._id}/disable`);
    row.doorAccessEnabled = false;
    ElMessage.success("门禁权限已取消");
  } catch (e: any) {
    const msg = e?.response?.data?.error || e?.message || "操作失败";
    ElMessage.error("操作失败：" + msg);
  } finally {
    row._loading = false;
  }
}

async function batchEnable() {
  const toEnable = selectedRows.value.filter((r) => !r.doorAccessEnabled);
  if (!toEnable.length) {
    ElMessage.info("已选行均已开通");
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确认为选中的 ${toEnable.length} 位业主开通门禁权限？`,
      "批量开通确认",
      {
        type: "info",
        confirmButtonText: "确认开通",
        cancelButtonText: "取消",
      },
    );
  } catch {
    return;
  }
  batchLoading.value = true;
  try {
    const res: any = await request.post(
      "/door/owner-permissions/batch-enable",
      { certIds: toEnable.map((r: any) => r._id) },
    );
    const { succeeded = [], failed = [] } = res.data || {};
    for (const id of succeeded) {
      const row = list.value.find((r) => r._id === id);
      if (row) row.doorAccessEnabled = true;
    }
    const msg = `成功 ${succeeded.length} 条${failed.length ? `，失败 ${failed.length} 条` : ""}`;
    failed.length === 0 ? ElMessage.success(msg) : ElMessage.warning(msg);
  } catch (e: any) {
    ElMessage.error("批量开通失败：" + (e?.message || "未知错误"));
  } finally {
    batchLoading.value = false;
    selectedRows.value = [];
  }
}

async function batchDisable() {
  const toDisable = selectedRows.value.filter((r) => r.doorAccessEnabled);
  if (!toDisable.length) {
    ElMessage.info("已选行均未开通");
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确认取消选中的 ${toDisable.length} 位业主的门禁权限？`,
      "批量取消确认",
      {
        type: "warning",
        confirmButtonText: "确认取消",
        cancelButtonText: "取消",
      },
    );
  } catch {
    return;
  }
  batchLoading.value = true;
  try {
    const res: any = await request.post(
      "/door/owner-permissions/batch-disable",
      { certIds: toDisable.map((r: any) => r._id) },
    );
    const { succeeded = [], failed = [] } = res.data || {};
    for (const id of succeeded) {
      const row = list.value.find((r) => r._id === id);
      if (row) row.doorAccessEnabled = false;
    }
    const msg = `成功 ${succeeded.length} 条${failed.length ? `，失败 ${failed.length} 条` : ""}`;
    failed.length === 0 ? ElMessage.success(msg) : ElMessage.warning(msg);
  } catch (e: any) {
    ElMessage.error("批量取消失败：" + (e?.message || "未知错误"));
  } finally {
    batchLoading.value = false;
    selectedRows.value = [];
  }
}

onMounted(() => {
  Promise.all([load(), loadDevices()]);
});
</script>
