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
          <el-input
            v-model="searchForm.publisher"
            placeholder="请输入发布人"
            clearable
            style="width: 150px"
          />
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
          <el-button type="primary" @click="handleAdd">添加新通知</el-button>
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
          <span style="font-weight: 600">通知</span>
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
      title="通知详情"
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
          <div style="white-space: pre-wrap">{{ currentRow.content }}</div>
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
import { ref, reactive, onMounted, computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import axios from "@/utils/axios";

const router = useRouter();
const searchForm = reactive({
  title: "",
  publisher: "",
});

const dateRange = ref<any>(null);
const tableData = ref<any[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);
const loading = ref(false);

const detailVisible = ref(false);
const currentRow = ref<any>(null);

// 获取当前用户的小区ID
const getCommunityId = () => {
  const raw = localStorage.getItem("admin-user");
  if (raw) {
    const user = JSON.parse(raw);
    return user.communityId;
  }
  return null;
};

async function fetchList() {
  loading.value = true;
  try {
    const params: any = {
      page: currentPage.value,
      pageSize: pageSize.value,
      type: "notification",
      communityId: getCommunityId(),
    };

    if (searchForm.title) params.title = searchForm.title;
    if (searchForm.publisher) params.publisher = searchForm.publisher;
    if (dateRange.value && dateRange.value.length === 2) {
      params.startDate = dateRange.value[0].toISOString();
      params.endDate = dateRange.value[1].toISOString();
    }

    const res = await axios.get("/notifications", { params });
    tableData.value = res.data || [];
    total.value = res.total || 0;
  } catch (err) {
    ElMessage.error("加载失败");
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  currentPage.value = 1;
  fetchList();
}

function handleReset() {
  searchForm.title = "";
  searchForm.publisher = "";
  dateRange.value = null;
  currentPage.value = 1;
  fetchList();
}

function handleAdd() {
  router.push({
    path: "/community-admin/notification-form",
  });
}

function handleEdit(row: any) {
  router.push({
    path: "/community-admin/notification-form",
    query: { id: row._id },
  });
}

function handleDetail(row: any) {
  currentRow.value = row;
  detailVisible.value = true;
}

async function handlePin(row: any) {
  try {
    await axios.put(`/notifications/${row._id}/pin`, {
      isPinned: !row.isPinned,
    });
    ElMessage.success(row.isPinned ? "取消置顶成功" : "置顶成功");
    fetchList();
  } catch (err) {
    ElMessage.error("操作失败");
  }
}

async function handleDisable(row: any) {
  try {
    const newStatus = row.status === "disabled" ? "published" : "disabled";
    await axios.put(`/notifications/${row._id}/status`, {
      status: newStatus,
    });
    ElMessage.success(newStatus === "disabled" ? "停用成功" : "启用成功");
    fetchList();
  } catch (err) {
    ElMessage.error("操作失败");
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm("确定删除该通知吗？", "提示", {
      type: "warning",
    });
    await axios.delete(`/notifications/${row._id}`);
    ElMessage.success("删除成功");
    fetchList();
  } catch (err: any) {
    if (err !== "cancel") {
      ElMessage.error("删除失败");
    }
  }
}

function formatDateTime(time: string) {
  if (!time) return "-";
  const d = new Date(time);
  return d.toLocaleString("zh-CN");
}

onMounted(() => {
  fetchList();
});
</script>

<style scoped>
.filter-form {
  display: flex;
  flex-wrap: wrap;
}
</style>
