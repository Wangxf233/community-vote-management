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

    <!-- 结果展示 -->
    <el-card v-if="companyResult" style="margin-top: 20px">
      <template #header>
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
          "
        >
          <span>{{ companyResult.title }}</span>
          <el-tag :type="getStatusType(companyResult.status)">
            {{ getStatusText(companyResult.status) }}
          </el-tag>
        </div>
      </template>

      <div style="margin-bottom: 20px">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="评价周期">
            {{ formatDate(companyResult.startDate) }} 至
            {{ formatDate(companyResult.endDate) }}
          </el-descriptions-item>
          <el-descriptions-item label="参与人数">
            {{ companyResult.participantCount || 0 }}/{{
              companyResult.totalUsers || 0
            }}
          </el-descriptions-item>
          <el-descriptions-item label="综合平均分">
            <el-tag type="success" size="large">{{
              companyResult.averageScore?.toFixed(1) || "-"
            }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <h4>各维度评分</h4>
      <el-descriptions :column="2" border style="margin-bottom: 20px">
        <el-descriptions-item
          v-for="(score, dim) in companyResult.dimensionScores"
          :key="dim"
          :label="dim"
        >
          {{ score.toFixed(1) }}
        </el-descriptions-item>
      </el-descriptions>

      <h4>具体评价内容</h4>
      <el-table :data="companyResult.evaluations" border>
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

      <el-pagination
        v-if="companyResult.evaluations && companyResult.evaluations.length > 0"
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="totalEvaluations"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 20px; justify-content: center"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </el-card>

    <el-empty v-else description="请选择评价周期查看结果" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import axios from "../../utils/axios";

const cyclesList = ref<any[]>([]);
const selectedCycleId = ref("");
const companyResult = ref<any>(null);
const currentPage = ref(1);
const pageSize = ref(10);
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

// 获取评价结果
const fetchResultsList = async () => {
  if (!selectedCycleId.value) {
    companyResult.value = null;
    return;
  }

  try {
    const response = await axios.get(
      `/evaluation/company-results/${selectedCycleId.value}`,
      {
        params: {
          page: currentPage.value,
          pageSize: pageSize.value,
        },
      }
    );

    companyResult.value = response.data;
    totalEvaluations.value = response.total || 0;
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || "获取评价结果失败");
  }
};

// 分页相关
const handleSizeChange = (size: number) => {
  pageSize.value = size;
  currentPage.value = 1;
  fetchResultsList();
};

const handleCurrentChange = (page: number) => {
  currentPage.value = page;
  fetchResultsList();
};

onMounted(async () => {
  await fetchCyclesList();

  // 从 sessionStorage 获取周期ID
  const cycleId = sessionStorage.getItem(
    "evaluationsManagement_company_selectedCycleId"
  );
  if (cycleId) {
    selectedCycleId.value = cycleId;
    sessionStorage.removeItem("evaluationsManagement_company_selectedCycleId");
    fetchResultsList();
  }
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
</style>
