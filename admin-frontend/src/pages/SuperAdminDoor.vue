<template>
  <div style="height: calc(100vh - 96px); display: flex; flex-direction: column; overflow: hidden">
    <el-card style="margin-bottom: 12px; flex-shrink: 0">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="小区名称" style="margin-bottom: 0">
          <el-input v-model="filters.name" placeholder="搜索小区名称" clearable @keyup.enter="onQuery" />
        </el-form-item>
        <el-form-item style="margin-bottom: 0">
          <el-button type="primary" @click="onQuery">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card style="flex: 1; display: flex; flex-direction: column; overflow: hidden">
      <div style="margin-bottom: 16px">
        <span style="font-weight: 600">已开通门禁小区</span>
        <span style="margin-left: 8px; color: #909399">共 {{ total }} 条</span>
      </div>
      <div style="flex: 1; overflow: hidden">
        <el-table :data="list" stripe v-loading="loading" height="100%">
          <el-table-column prop="name" label="小区名称" min-width="140" show-overflow-tooltip />
          <el-table-column label="省" width="240" align="center">
            <template #default="{ row }">{{ row.region && row.region[0] ? row.region[0] : "-" }}</template>
          </el-table-column>
          <el-table-column label="市" width="240" align="center">
            <template #default="{ row }">{{ row.region && row.region[1] ? row.region[1] : "-" }}</template>
          </el-table-column>
          <el-table-column label="区" width="240" align="center">
            <template #default="{ row }">{{ row.region && row.region[2] ? row.region[2] : "-" }}</template>
          </el-table-column>
          <el-table-column prop="address" label="详细地址" min-width="140" show-overflow-tooltip />
          <el-table-column label="开通时间" width="170">
            <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="primary" @click="onManageDevices(row)">管理门禁</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 12px; justify-content: flex-end"
        @size-change="fetchList"
        @current-change="fetchList"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import request from "../utils/axios";

interface CommunityItem {
  _id: string;
  name: string;
  address?: string;
  region?: string[];
  createdAt?: string;
}

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

const router = useRouter();
const filters = reactive({ name: "" });
const list = ref<CommunityItem[]>([]);
const loading = ref(false);
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);

async function fetchList() {
  loading.value = true;
  try {
    const params: Record<string, string | number> = { page: currentPage.value, pageSize: pageSize.value };
    if (filters.name) params.name = filters.name;
    const res: any = await request.get("/door/communities", { params });
    list.value = res.data || [];
    total.value = res.total || 0;
  } catch (e: any) {
    ElMessage.error("加载小区列表失败：" + (e?.message || "未知错误"));
    list.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function onQuery() {
  currentPage.value = 1;
  fetchList();
}
function onReset() {
  filters.name = "";
  currentPage.value = 1;
  fetchList();
}
function onManageDevices(row: CommunityItem) {
  router.push(
    `/admin/door/devices?communityId=${encodeURIComponent(row._id)}&communityName=${encodeURIComponent(row.name)}`,
  );
}

onMounted(() => {
  fetchList();
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
