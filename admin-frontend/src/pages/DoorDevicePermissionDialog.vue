<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="`权限配置 — ${props.deviceName}`"
    width="900px"
    :close-on-click-modal="false"
    @update:model-value="(val: boolean) => emit('update:modelValue', val)"
    @open="onOpen"
  >
    <!-- 搜索过滤 -->
    <el-card shadow="never" style="margin-bottom: 12px;">
      <el-form :inline="true" :model="filters">
        <el-form-item label="姓名/手机号">
          <el-input
            v-model="filters.search"
            placeholder="输入姓名或手机号搜索"
            clearable
            style="width: 180px"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSearch">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 表格 -->
    <el-card shadow="never">
      <div style="display: flex; gap: 8px; margin-bottom: 12px;">
        <el-button
          type="primary"
          :disabled="selectedRows.length === 0"
          :loading="batchLoading"
          @click="onBatchGrant"
        >
          批量授权
          <template v-if="selectedRows.length > 0">({{ selectedRows.length }})</template>
        </el-button>
        <el-button
          type="danger"
          :disabled="selectedRows.length === 0"
          :loading="batchLoading"
          @click="onBatchRevoke"
        >
          批量撤销
          <template v-if="selectedRows.length > 0">({{ selectedRows.length }})</template>
        </el-button>
      </div>

      <el-table
        ref="ownerTableRef"
        :data="ownerList"
        v-loading="tableLoading"
        stripe
        max-height="400"
        @selection-change="onOwnerSelectionChange"
      >
        <el-table-column type="selection" width="44" />
        <el-table-column prop="name" label="姓名" min-width="90" />
        <el-table-column prop="building" label="楼栋" width="80" align="center" />
        <el-table-column prop="unit" label="单元" width="80" align="center" />
        <el-table-column prop="room" label="房号" width="80" align="center" />
        <el-table-column label="手机号" width="130">
          <template #default="{ row }">
            {{ maskPhone(row.phone) }}
          </template>
        </el-table-column>
        <el-table-column label="权限状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="row.hasPermission ? 'success' : 'info'" size="small">
              {{ row.hasPermission ? "已授权" : "未授权" }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="!tableLoading && ownerList.length === 0" style="text-align: center; color: #999; padding: 32px 0;">
        暂无业主数据
      </div>

      <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
        <el-pagination
          v-model:current-page="ownerPage"
          v-model:page-size="ownerPageSize"
          :page-sizes="[10, 20, 50]"
          :total="ownerTotal"
          layout="total, sizes, prev, pager, next"
          @size-change="loadOwnerList"
          @current-change="loadOwnerList"
        />
      </div>
    </el-card>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import request from "../utils/axios";

interface OwnerItem {
  _id: string;
  openid: string;
  name: string;
  phone: string;
  building: string;
  unit: string;
  room: string;
  hasPermission: boolean;
}

interface BuildingOption {
  building: string;
  buildingName: string;
  units: string[];
}

const props = defineProps<{
  modelValue: boolean;
  deviceId: string;
  communityId: string;
  deviceName: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", val: boolean): void;
}>();

// 位置选项
const locationOptions = ref<{ buildings: BuildingOption[] }>({ buildings: [] });

// 搜索过滤
const filters = reactive({
  search: "",
  building: "",
  unit: "",
});

const unitOptions = computed(() => {
  if (!filters.building) return [];
  const target = locationOptions.value.buildings.find(
    (b) => b.building === filters.building,
  );
  return target ? target.units : [];
});

function onBuildingChange() {
  filters.unit = "";
}

function onSearch() {
  ownerPage.value = 1;
  loadOwnerList();
}

function onReset() {
  filters.search = "";
  filters.building = "";
  filters.unit = "";
  ownerPage.value = 1;
  loadOwnerList();
}

// 业主列表
const ownerList = ref<OwnerItem[]>([]);
const tableLoading = ref(false);
const batchLoading = ref(false);
const ownerPage = ref(1);
const ownerPageSize = ref(20);
const ownerTotal = ref(0);
const ownerTableRef = ref();
const selectedRows = ref<OwnerItem[]>([]);
// 本地授权/撤销缓存，修正服务端可能的延迟
const localGrantedIds = new Set<string>();
const localRevokedIds = new Set<string>();

function onOwnerSelectionChange(rows: OwnerItem[]) {
  selectedRows.value = rows;
}

function maskPhone(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\s/g, "");
  if (cleaned.length >= 7) {
    return cleaned.slice(0, 3) + "****" + cleaned.slice(-4);
  }
  return cleaned;
}

async function loadLocationOptionsData() {
  try {
    const params: Record<string, string> = {};
    if (props.communityId) params.communityId = props.communityId;
    const body: any = await request.get("/door/location-options", { params });
    locationOptions.value = body?.data || { buildings: [] };
  } catch (_e) {
    locationOptions.value = { buildings: [] };
  }
}

async function loadOwnerList() {
  tableLoading.value = true;
  try {
    const params: Record<string, string | number> = {
      communityId: props.communityId,
      page: ownerPage.value,
      pageSize: ownerPageSize.value,
    };
    if (filters.search) params.search = filters.search;
    if (filters.building) params.building = filters.building;
    if (filters.unit) params.unit = filters.unit;

    const body: any = await request.get(
      `/door/device/${props.deviceId}/owner-list`,
      { params },
    );
    const owners = body?.data || [];
    ownerTotal.value = body?.total || 0;
    // 客户端自治匹配权限：优先用后端返回的 grantedOwnerIds，确保不依赖单字段匹配
    const grantedIds = new Set((body?.grantedOwnerIds || []).map(String));
    const grantedOpenids = new Set((body?.grantedOwnerOpenids || []).map(String));
    ownerList.value = owners.map((o: any) => ({
      ...o,
      hasPermission:
        // 本地缓存优先：明确撤销 > 明确授权 > 服务端判断
        localRevokedIds.has(o._id) ? false :
        localGrantedIds.has(o._id) ? true :
        (grantedIds.has(String(o._id)) || grantedOpenids.has(String(o.openid || ""))),
    }));
  } catch (e: any) {
    ElMessage.error("加载业主列表失败：" + (e?.message || "未知错误"));
    ownerList.value = [];
    ownerTotal.value = 0;
  } finally {
    tableLoading.value = false;
  }
}

// --- 批量授权 ---
async function onBatchGrant() {
  if (selectedRows.value.length === 0) {
    ElMessage.warning("请先勾选业主");
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确认对选中的 ${selectedRows.value.length} 位业主授权门禁「${props.deviceName}」？`,
      "批量授权确认",
      { type: "info", confirmButtonText: "确认授权", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  batchLoading.value = true;
  try {
    const items = selectedRows.value.map((r) => ({ ownerId: r._id, openid: r.openid || "" }));
    const ownerIds = items.map((i) => i.ownerId);
    await request.post(`/door/device/${props.deviceId}/grant-permissions`, {
      communityId: props.communityId,
      items,
    });
    // 本地立即标记 + 缓存，不再等服务端刷新
    const grantedSet = new Set(ownerIds);
    grantedSet.forEach((id) => { localGrantedIds.add(id); localRevokedIds.delete(id); });
    ownerList.value.forEach((o) => {
      if (grantedSet.has(o._id)) o.hasPermission = true;
    });
    ElMessage.success(`已为 ${ownerIds.length} 位业主授权`);
    selectedRows.value = [];
  } catch (e: any) {
    const msg = e?.response?.data?.error || e?.message || "操作失败";
    ElMessage.error("批量授权失败：" + msg);
  } finally {
    batchLoading.value = false;
  }
}

// --- 批量撤销 ---
async function onBatchRevoke() {
  if (selectedRows.value.length === 0) {
    ElMessage.warning("请先勾选业主");
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确认撤销选中的 ${selectedRows.value.length} 位业主在「${props.deviceName}」上的权限？撤销后将立即无法通行。`,
      "批量撤销确认",
      { type: "warning", confirmButtonText: "确认撤销", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  batchLoading.value = true;
  try {
    const ownerIds = selectedRows.value.map((r) => r._id);
    await request.post(`/door/device/${props.deviceId}/revoke-permissions`, {
      communityId: props.communityId,
      ownerIds,
    });
    // 本地立即标记 + 缓存
    const revokedSet = new Set(ownerIds);
    revokedSet.forEach((id) => { localRevokedIds.add(id); localGrantedIds.delete(id); });
    ownerList.value.forEach((o) => {
      if (revokedSet.has(o._id)) o.hasPermission = false;
    });
    ElMessage.success(`已撤销 ${ownerIds.length} 位业主的权限`);
    selectedRows.value = [];
  } catch (e: any) {
    const msg = e?.response?.data?.error || e?.message || "操作失败";
    ElMessage.error("批量撤销失败：" + msg);
  } finally {
    batchLoading.value = false;
  }
}

async function onOpen() {
  if (!props.deviceId) return;
  ownerPage.value = 1;
  filters.search = "";
  selectedRows.value = [];
  localGrantedIds.clear();
  localRevokedIds.clear();
  await loadOwnerList();
}
</script>
