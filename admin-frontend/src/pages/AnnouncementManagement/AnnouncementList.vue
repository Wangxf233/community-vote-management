<template>
  <div style="height: 100%; display: flex; flex-direction: column">
    <!-- 筛选工具栏 -->
    <el-card style="margin-bottom: 12px; flex-shrink: 0">
      <el-form :inline="true" :model="searchForm" class="filter-form">
        <el-form-item label="标题" style="margin-bottom: 0">
          <el-input
            v-model="searchForm.title"
            placeholder="请输入标题"
            clearable
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="发布人" style="margin-bottom: 0">
          <el-select
            v-model="searchForm.publisher"
            placeholder="发布人"
            clearable
            style="width: 150px"
          >
            <el-option label="业委会" value="业委会" />
            <el-option label="物业公司" value="物业公司" />
          </el-select>
        </el-form-item>
        <el-form-item label="发布时间" style="margin-bottom: 0">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 240px"
          />
        </el-form-item>
        <el-form-item style="margin-bottom: 0">
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
        <el-form-item style="margin-bottom: 0; margin-left: auto">
          <el-button type="primary" @click="handleAdd">添加新信息</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 表格 -->
    <el-card
      style="flex: 1; display: flex; flex-direction: column; overflow: hidden"
    >
      <div
        style="
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        "
      >
        <div>
          <span style="font-weight: 600">{{ typeLabel }}</span>
          <span style="margin-left: 12px; color: #999">共 {{ total }} 条</span>
        </div>
      </div>

      <div style="flex: 1; width: 100%; overflow: hidden">
        <el-table
          :data="tableData"
          stripe
          style="width: 100%"
          v-loading="loading"
          height="100%"
        >
          <el-table-column prop="title" label="标题" min-width="200" />
          <el-table-column prop="publisher" label="发布人" width="120" />
          <el-table-column label="发布时间" width="180">
            <template #default="{ row }">
              {{ formatDateTime(row.publishTime) }}
            </template>
          </el-table-column>
          <el-table-column prop="content" label="详情" min-width="300">
            <template #default="{ row }">
              <div
                style="
                  max-width: 100%;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                "
              >
                {{ row.content }}
              </div>
            </template>
          </el-table-column>
          <el-table-column label="附件" width="100">
            <template #default="{ row }">
              {{ row.attachments?.length || 0 }} 个
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.isPinned" type="danger" size="small"
                >置顶</el-tag
              >
              <el-tag
                v-else-if="row.status === 'published'"
                type="success"
                size="small"
                >已发布</el-tag
              >
              <el-tag
                v-else-if="row.status === 'scheduled'"
                type="info"
                size="small"
                >定时发布</el-tag
              >
              <el-tag v-else type="warning" size="small">已停用</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="420" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="primary" @click="handleDetail(row)"
                >详情</el-button
              >
              <el-button size="small" type="primary" @click="handleEdit(row)"
                >编辑</el-button
              >
              <el-button
                size="small"
                :type="row.isPinned ? 'warning' : 'success'"
                @click="handlePin(row)"
              >
                {{ row.isPinned ? "取消置顶" : "置顶" }}
              </el-button>
              <el-button
                size="small"
                :type="row.status === 'disabled' ? 'success' : 'warning'"
                @click="handleDisable(row)"
              >
                {{ row.status === "disabled" ? "启用" : "停用" }}
              </el-button>
              <el-button size="small" type="danger" @click="handleDelete(row)"
                >删除</el-button
              >
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 分页 -->
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 20px; justify-content: center"
        @size-change="fetchList"
        @current-change="fetchList"
      />
    </el-card>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      title="公告详情"
      width="60%"
      destroy-on-close
    >
      <el-descriptions :column="2" border v-if="currentRow">
        <el-descriptions-item label="标题" :span="2">{{
          currentRow.title
        }}</el-descriptions-item>
        <el-descriptions-item label="发布人">{{
          currentRow.publisher
        }}</el-descriptions-item>
        <el-descriptions-item label="发布时间">{{
          formatDateTime(currentRow.publishTime)
        }}</el-descriptions-item>
        <el-descriptions-item label="详情" :span="2">
          <div style="white-space: pre-wrap; word-break: break-all; overflow-wrap: break-word; overflow: hidden">{{ currentRow.content }}</div>
        </el-descriptions-item>
        <el-descriptions-item label="附件" :span="2">
          <div
            v-if="currentRow.attachments && currentRow.attachments.length > 0"
          >
            <div
              v-for="(file, index) in currentRow.attachments"
              :key="index"
              style="margin-bottom: 8px"
            >
              <el-link :href="file.url" target="_blank" type="primary">
                {{ file.name }}
              </el-link>
            </div>
          </div>
          <span v-else style="color: #909399">无附件</span>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import axios from "../../utils/axios";

const props = defineProps<{
  type: string;
}>();

const typeLabel = computed(() => {
  const labels: Record<string, string> = {
    committee: "业委会信息公示",
    property: "物业信息公示",
    law: "法律法规",
    industry: "行业动态",
  };
  return labels[props.type] || "信息";
});

const router = useRouter();
const loading = ref(false);
const tableData = ref<any[]>([]);
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);
const dateRange = ref<[Date, Date] | null>(null);
const detailVisible = ref(false);
const currentRow = ref<any>(null);

const searchForm = ref({
  title: "",
  publisher: "",
});

// 获取当前登录的小区ID
const getCommunityId = () => {
  try {
    const userStr = localStorage.getItem("admin-user");
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.communityId || "";
    }
  } catch (e) {
    console.error("获取用户信息失败:", e);
  }
  return "";
};

const communityId = getCommunityId();

// 格式化日期时间
const formatDateTime = (date: string) => {
  if (!date) return "";
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(
    2,
    "0",
  )}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// 获取列表
const fetchList = async () => {
  loading.value = true;
  try {
    const params: any = {
      communityId,
      type: props.type,
      page: currentPage.value,
      pageSize: pageSize.value,
    };

    if (searchForm.value.title) params.title = searchForm.value.title;
    if (searchForm.value.publisher)
      params.publisher = searchForm.value.publisher;
    if (dateRange.value) {
      params.startDate = dateRange.value[0].toISOString();
      params.endDate = dateRange.value[1].toISOString();
    }

    const res = await axios.get("/announcements", { params });
    tableData.value = res.data;
    total.value = res.total;
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || "获取列表失败");
  } finally {
    loading.value = false;
  }
};

// 查询
const handleSearch = () => {
  currentPage.value = 1;
  fetchList();
};

// 重置
const handleReset = () => {
  searchForm.value = {
    title: "",
    publisher: "",
  };
  dateRange.value = null;
  currentPage.value = 1;
  fetchList();
};

// 添加
const handleAdd = () => {
  router.push({
    path: "/community-admin/announcement-form",
    query: { type: props.type },
  });
};

// 编辑
const handleEdit = (row: any) => {
  router.push({
    path: "/community-admin/announcement-form",
    query: { id: row._id, type: props.type },
  });
};

// 详情
const handleDetail = (row: any) => {
  currentRow.value = row;
  detailVisible.value = true;
};

// 置顶
const handlePin = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要${row.isPinned ? "取消置顶" : "置顶"}该公告吗？`,
      "提示",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      },
    );

    await axios.put(`/announcements/${row._id}/pin`, {
      isPinned: !row.isPinned,
    });

    ElMessage.success("操作成功");
    fetchList();
  } catch (error: any) {
    if (error !== "cancel") {
      ElMessage.error(error.response?.data?.error || "操作失败");
    }
  }
};

// 停用/启用
const handleDisable = async (row: any) => {
  const action = row.status === "disabled" ? "启用" : "停用";
  try {
    await ElMessageBox.confirm(`确定要${action}该公告吗？`, "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });

    await axios.put(`/announcements/${row._id}/status`, {
      status: row.status === "disabled" ? "published" : "disabled",
    });

    ElMessage.success("操作成功");
    fetchList();
  } catch (error: any) {
    if (error !== "cancel") {
      ElMessage.error(error.response?.data?.error || "操作失败");
    }
  }
};

// 删除
const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm("确定要删除该公告吗？此操作不可恢复", "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });

    await axios.delete(`/announcements/${row._id}`);
    ElMessage.success("删除成功");
    fetchList();
  } catch (error: any) {
    if (error !== "cancel") {
      ElMessage.error(error.response?.data?.error || "删除失败");
    }
  }
};

// 监听type变化，重新加载数据
watch(
  () => props.type,
  () => {
    currentPage.value = 1;
    fetchList();
  },
);

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
