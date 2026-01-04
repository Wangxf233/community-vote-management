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
              cycle.startDate
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
            <h4>被评人员详情</h4>
            <el-table :data="row.staffResults" border style="width: 100%">
              <el-table-column label="照片" width="80">
                <template #default="{ row: staff }">
                  <el-image
                    v-if="staff.photo"
                    :src="staff.photo"
                    fit="cover"
                    style="width: 50px; height: 50px; border-radius: 4px"
                  />
                  <div
                    v-else
                    style="
                      width: 50px;
                      height: 50px;
                      background: #f0f0f0;
                      border-radius: 4px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      color: #909399;
                    "
                  >
                    无
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="name" label="姓名" width="120" />
              <el-table-column prop="position" label="职位" width="120" />
              <el-table-column
                v-for="dim in row.dimensions"
                :key="dim.name"
                :label="dim.name"
                min-width="100"
              >
                <template #default="{ row: staff }">
                  {{ staff.dimensionScores[dim.name]?.toFixed(1) || "-" }}
                </template>
              </el-table-column>
              <el-table-column label="综合平均分" min-width="120">
                <template #default="{ row: staff }">
                  <el-tag type="success">{{
                    staff.averageScore?.toFixed(1) || "-"
                  }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column
                prop="evaluationCount"
                label="评价数量"
                min-width="100"
              />
              <el-table-column label="操作" width="120" fixed="right">
                <template #default="{ row: staff }">
                  <el-button
                    type="primary"
                    size="small"
                    @click="handleViewDetails(row, staff)"
                  >
                    查看详情
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
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
      <el-table-column label="参与人数" width="100">
        <template #default="{ row }">
          {{ row.participantCount || 0 }}/{{ row.totalUsers || 0 }}
        </template>
      </el-table-column>
    </el-table>

    <!-- 评价详情对话框 -->
    <el-dialog v-model="detailDialogVisible" title="评价详情" width="800px">
      <div v-if="currentStaffDetail">
        <div class="detail-header">
          <el-image
            v-if="currentStaffDetail.photo"
            :src="currentStaffDetail.photo"
            fit="cover"
            style="
              width: 80px;
              height: 80px;
              border-radius: 8px;
              margin-right: 20px;
            "
          />
          <div>
            <h3>{{ currentStaffDetail.name }}</h3>
            <div style="color: #909399">{{ currentStaffDetail.position }}</div>
            <div style="margin-top: 10px">
              综合平均分：<el-tag type="success" size="large">{{
                currentStaffDetail.averageScore?.toFixed(1)
              }}</el-tag>
            </div>
          </div>
        </div>

        <el-divider />

        <h4>各维度评分</h4>
        <el-descriptions :column="2" border>
          <el-descriptions-item
            v-for="(score, dim) in currentStaffDetail.dimensionScores"
            :key="dim"
            :label="dim"
          >
            {{ score.toFixed(1) }}
          </el-descriptions-item>
        </el-descriptions>

        <h4 style="margin-top: 20px">具体评价内容</h4>
        <el-table :data="currentStaffDetail.evaluations" border>
          <el-table-column prop="userName" label="业主姓名" width="120" />
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
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import axios from "../../utils/axios";

const route = useRoute();

const resultsList = ref<any[]>([]);
const cyclesList = ref<any[]>([]);
const selectedCycleId = ref("");
const expandedRows = ref<string[]>([]);
const detailDialogVisible = ref(false);
const currentStaffDetail = ref<any>(null);

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
    "0"
  )}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(
    2,
    "0"
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
    const response = await axios.get("/evaluation/cycles", {
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

    const response = await axios.get("/evaluation/results", {
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

// 查看详情
const handleViewDetails = async (cycle: any, staff: any) => {
  try {
    const response = await axios.get(
      `/evaluation/results/${cycle._id}/staff/${staff.staffId}`
    );

    currentStaffDetail.value = response.data;
    detailDialogVisible.value = true;
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || "获取详情失败");
  }
};

onMounted(async () => {
  await fetchCyclesList();

  // 从 sessionStorage 获取周期ID
  const cycleId = sessionStorage.getItem(
    "evaluationsManagement_selectedCycleId"
  );
  if (cycleId) {
    selectedCycleId.value = cycleId;
    sessionStorage.removeItem("evaluationsManagement_selectedCycleId");
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

.staff-info {
  display: flex;
  align-items: center;
}

.detail-header {
  display: flex;
  align-items: center;
}

.detail-header h3 {
  margin: 0 0 5px 0;
}
</style>
