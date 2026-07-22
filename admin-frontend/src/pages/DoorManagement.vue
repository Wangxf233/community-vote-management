<template>
  <div class="door-management-page">
    <el-card>
      <template #header>
        <div class="list-header">
          <div class="card-title">门禁设备列表</div>
          <div class="actions">
            <el-button v-if="communityId" type="primary" @click="goCreate"
              >添加设备</el-button
            >
            <el-button type="danger" :loading="deleting" @click="deleteSelected"
              >批量删除</el-button
            >
          </div>
        </div>
      </template>

      <el-table
        ref="tableRef"
        :data="devices"
        v-loading="loading"
        border
        empty-text="暂无门禁设备"
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="48" />
        <el-table-column prop="deviceName" label="设备名称" min-width="180" />
        <el-table-column prop="serial" label="设备序列号" min-width="180" />
        <el-table-column label="门禁类型" width="120">
          <template #default="scope">
            {{
              scope.row.locationType === "unit_gate" ? "楼栋单元门" : "小区大门"
            }}
          </template>
        </el-table-column>
        <el-table-column label="地点" min-width="220">
          <template #default="scope">
            {{ formatLocation(scope.row) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="scope">
            <el-tag :type="scope.row.enabled ? 'success' : 'info'">
              {{ scope.row.enabled ? "启用" : "禁用" }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import request from "../utils/axios";

const props = defineProps<{
  communityId?: string;
}>();

type DoorDevice = {
  _id: string;
  deviceName: string;
  serial: string;
  enabled: boolean;
  locationType: "community_gate" | "unit_gate";
  gateName?: string;
  locationLabel?: string;
  building?: string;
  unit?: string;
  buildingLabel?: string;
  unitLabel?: string;
  loginId?: string;
};

const router = useRouter();
const loading = ref(false);
const deleting = ref(false);
const devices = ref<DoorDevice[]>([]);
const selectedRows = ref<DoorDevice[]>([]);
const tableRef = ref();

function goCreate() {
  if (props.communityId) {
    router.push(`/admin/door/devices/create?communityId=${props.communityId}`);
  } else {
    router.push("/community-admin/door-management/create");
  }
}

function onSelectionChange(rows: DoorDevice[]) {
  selectedRows.value = rows;
}

function formatLocation(item: DoorDevice) {
  if (item.locationType === "unit_gate") {
    const b = String(item.buildingLabel || item.building || "").trim();
    const u = String(item.unitLabel || item.unit || "").trim();
    if (!b || !u) {
      return item.locationLabel || "";
    }
    const buildingPart = b.includes("栋") ? b : `${b}栋`;
    const unitPart = u.includes("单元") ? u : `${u}单元`;
    return `${buildingPart}${unitPart}`;
  }
  return item.gateName || item.locationLabel || "";
}

async function loadDevices() {
  loading.value = true;
  try {
    const params: Record<string, string> = {};
    if (props.communityId) params.communityId = props.communityId;
    const body: any = await request.get("/door/devices", { params });
    devices.value = body?.data || [];
  } catch (error) {
    console.error(error);
    ElMessage.error("加载门禁设备失败");
  } finally {
    loading.value = false;
  }
}

async function deleteSelected() {
  if (!selectedRows.value.length) {
    ElMessage.warning("请先勾选要删除的设备");
    return;
  }

  const { value: loginPassword } = await ElMessageBox.prompt(
    "请输入管理用户密码（md5后）用于调用 data.login.device.delete",
    "批量删除确认",
    {
      inputType: "password",
      confirmButtonText: "确认删除",
      cancelButtonText: "取消",
      inputPlaceholder: "管理用户密码（md5后）",
      closeOnClickModal: false,
    },
  );

  deleting.value = true;
  let ok = 0;
  let fail = 0;

  try {
    for (const row of selectedRows.value) {
      try {
        if (!row.loginId) {
          throw new Error("设备缺少loginId");
        }

        await request.post("/door/fondcard/login-device/delete", {
          loginId: row.loginId,
          password: loginPassword,
          serial: row.serial,
        });

        await request.delete(`/door/devices/${row._id}`);
        ok += 1;
      } catch (e) {
        console.error("delete one failed:", row.serial, e);
        fail += 1;
      }
    }

    if (ok > 0) {
      ElMessage.success(
        `批量删除完成：成功 ${ok} 条${fail > 0 ? `，失败 ${fail} 条` : ""}`,
      );
    } else {
      ElMessage.error("批量删除失败，请检查loginId/密码或设备状态");
    }

    await loadDevices();
    if (tableRef.value) {
      tableRef.value.clearSelection();
    }
  } catch (error) {
    if (String(error).includes("cancel")) {
      return;
    }
    console.error(error);
    ElMessage.error("批量删除失败");
  } finally {
    deleting.value = false;
  }
}

onMounted(async () => {
  await loadDevices();
});
</script>

<style scoped>
.door-management-page {
  padding-bottom: 16px;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.actions {
  display: flex;
  gap: 8px;
}

.card-title {
  font-weight: 600;
}
</style>
