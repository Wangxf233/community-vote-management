<template>
  <div class="results-list">
    <div class="toolbar">
      <div style="display: flex; gap: 10px; align-items: center">
        <el-select
          v-model="selectedCycleId"
          placeholder="选择评价周期"
          style="width: 400px"
          clearable
          @change="fetchResultsList"
        >
          <el-option
            v-for="cycle in cyclesList"
            :key="cycle._id"
            :label="`${cycle.title} (${formatDate(
              cycle.startDate,
            )} 至 ${formatDate(cycle.endDate)})`"
            :value="cycle._id"
          />
        </el-select>
        <el-button type="primary" @click="fetchResultsList">查询</el-button>
      </div>
    </div>

    <!-- 父子展开表格 -->
    <el-table
      :data="resultsList"
      border
      stripe
      style="width: 100%; margin-top: 20px"
      row-key="_id"
      :expand-row-keys="expandedRows"
      @expand-change="handleExpandChange"
    >
      <el-table-column type="expand">
        <template #default="{ row }">
          <div class="expand-content">
            <h4>评价详情</h4>

            <div style="margin-bottom: 20px">
              <el-descriptions :column="2" border>
                <el-descriptions-item label="综合平均分">
                  <el-tag type="success" size="large">{{
                    row.averageScore?.toFixed(1) || "-"
                  }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="评价数量">
                  {{ row.evaluationCount || 0 }}
                </el-descriptions-item>
              </el-descriptions>
            </div>

            <h4>各维度评分</h4>
            <el-table
              :data="getDimensionsData(row)"
              border
              style="margin-bottom: 20px"
            >
              <el-table-column prop="name" label="维度名称" width="200" />
              <el-table-column prop="score" label="平均分" width="150">
                <template #default="{ row: dim }">
                  {{ dim.score?.toFixed(1) || "-" }}
                </template>
              </el-table-column>
            </el-table>

            <el-button type="primary" @click="handleViewDetails(row)">
              查看具体评价内容
            </el-button>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="评价标题" min-width="200" />
      <el-table-column label="评价周期" width="220">
        <template #default="{ row }">
          {{ formatDate(row.startDate) }} 至 {{ formatDate(row.endDate) }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">
            {{ getStatusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="参与人数/总人数" width="150">
        <template #default="{ row }">
          {{ row.participantCount || 0 }}/{{ row.totalUsers || 0 }}
          <span v-if="row.totalUsers > 0" style="color: #909399">
            ({{
              (((row.participantCount || 0) / row.totalUsers) * 100).toFixed(0)
            }}%)
          </span>
        </template>
      </el-table-column>
      <el-table-column label="综合平均分" width="120">
        <template #default="{ row }">
          <el-tag type="success">{{
            row.averageScore?.toFixed(1) || "-"
          }}</el-tag>
        </template>
      </el-table-column>
    </el-table>

    <!-- 评价详情对话框 -->
    <el-dialog v-model="detailDialogVisible" title="具体评价内容" width="900px">
      <div v-if="currentCycleDetail">
        <div style="margin-bottom: 20px">
          <h4>{{ currentCycleDetail.title }}</h4>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="评价周期">
              {{ formatDate(currentCycleDetail.startDate) }} 至
              {{ formatDate(currentCycleDetail.endDate) }}
            </el-descriptions-item>
            <el-descriptions-item label="综合平均分">
              <el-tag type="success" size="large">{{
                currentCycleDetail.averageScore?.toFixed(1) || "-"
              }}</el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <el-table :data="currentCycleDetail.evaluations" border>
          <el-table-column prop="userName" label="业主姓名" width="120" />
          <el-table-column label="各维度评分" min-width="200">
            <template #default="{ row }">
              <el-tag
                v-for="(score, dim) in row.scores"
                :key="dim"
                style="margin-right: 5px"
              >
                {{ dim }}: {{ score }}分
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="comment" label="留言板" min-width="200">
            <template #default="{ row }">
              <span v-if="row.comment">{{ row.comment }}</span>
              <span v-else style="color: #909399">未留言</span>
            </template>
          </el-table-column>
          <el-table-column label="提交时间" width="180">
            <template #default="{ row }">
              {{ formatDateTime(row.createdAt) }}
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          v-if="totalEvaluations > 0"
          v-model:current-page="detailCurrentPage"
          v-model:page-size="detailPageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="totalEvaluations"
          layout="total, sizes, prev, pager, next, jumper"
          style="margin-top: 20px; justify-content: center"
          @size-change="handleDetailSizeChange"
          @current-change="handleDetailCurrentChange"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import axios from "../../utils/axios";

const resultsList = ref<any[]>([]);
const cyclesList = ref<any[]>([]);
const selectedCycleId = ref("");
const expandedRows = ref<string[]>([]);
const detailDialogVisible = ref(false);
const currentCycleDetail = ref<any>(null);
const detailCurrentPage = ref(1);
const detailPageSize = ref(10);
const totalEvaluations = ref(0);

// 格式化日期
const formatDate = (date: string) => {
  if (!date) return "";
  return date.split("T")[0];
};

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

// 获取状态类型
const getStatusType = (status: string) => {
  const map: any = {
    draft: "info",
    ongoing: "success",
    closed: "warning",
  };
  return map[status] || "info";
};

// 获取状态文本
const getStatusText = (status: string) => {
  const map: any = {
    draft: "未开始",
    ongoing: "进行中",
    closed: "已截止",
  };
  return map[status] || status;
};

// 获取评价周期列表
const fetchCyclesList = async () => {
  try {
    const user = JSON.parse(localStorage.getItem("admin-user") || "{}");
    const communityId = user.communityId;
    const response = await axios.get("/evaluation/company-cycles", {
      params: {
        communityId,
        pageSize: 1000,
      },
    });
    cyclesList.value = response.data;
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || "获取评价周期列表失败");
  }
};

// 获取评价结果列表
const fetchResultsList = async () => {
  try {
    const user = JSON.parse(localStorage.getItem("admin-user") || "{}");
    const communityId = user.communityId;
    const params: any = { communityId };
    if (selectedCycleId.value) {
      params.cycleId = selectedCycleId.value;
    }

    const response = await axios.get("/evaluation/company-results", {
      params,
    });

    resultsList.value = response.data;
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || "获取评价结果失败");
  }
};

// 展开行变化
const handleExpandChange = (row: any, expandedRowsData: any[]) => {
  expandedRows.value = expandedRowsData.map((r) => r._id);
};

// 获取维度数据（用于表格展示）
const getDimensionsData = (cycle: any) => {
  return Object.entries(cycle.dimensionScores || {}).map(([name, score]) => ({
    name,
    score,
  }));
};

// 查看详情
const handleViewDetails = async (cycle: any) => {
  try {
    const response = await axios.get(
      `/evaluation/company-results/${cycle._id}`,
      {
        params: {
          page: detailCurrentPage.value,
          pageSize: detailPageSize.value,
        },
      },
    );

    currentCycleDetail.value = response.data;
    totalEvaluations.value = response.total || 0;
    detailDialogVisible.value = true;
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || "获取详情失败");
  }
};

// 详情页分页相关
const handleDetailSizeChange = (size: number) => {
  detailPageSize.value = size;
  detailCurrentPage.value = 1;
  if (currentCycleDetail.value) {
    handleViewDetails(currentCycleDetail.value);
  }
};

const handleDetailCurrentChange = (page: number) => {
  detailCurrentPage.value = page;
  if (currentCycleDetail.value) {
    handleViewDetails(currentCycleDetail.value);
  }
};

onMounted(async () => {
  await fetchCyclesList();

  // 从 sessionStorage 获取周期ID
  const cycleId = sessionStorage.getItem(
    "evaluationsManagement_company_selectedCycleId",
  );
  if (cycleId) {
    selectedCycleId.value = cycleId;
    sessionStorage.removeItem("evaluationsManagement_company_selectedCycleId");
  }

  fetchResultsList();
});
</script>

<style scoped>
.results-list {
  padding: 20px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.expand-content {
  padding: 20px;
  background-color: #f5f7fa;
}

.expand-content h4 {
  margin: 0 0 15px 0;
  color: #303133;
}
</style>
