<template>
  <div
    style="
      height: calc(100vh - 96px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    "
  >
    <!-- 权限检查 -->
    <el-card v-if="!hasAnyPermission" style="text-align: center; padding: 40px">
      <el-empty description="暂无权限" />
    </el-card>

    <template v-else>
      <!-- 选项卡切换 -->
      <el-card style="margin-bottom: 12px; flex-shrink: 0">
        <el-radio-group v-model="activeTab" @change="handleTabChange">
          <el-radio-button v-if="hasPermission('repair')" value="repair">
            报修
          </el-radio-button>
          <el-radio-button v-if="hasPermission('report')" value="report">
            报事
          </el-radio-button>
        </el-radio-group>
      </el-card>

      <!-- 筛选条件 -->
      <el-card style="margin-bottom: 12px; flex-shrink: 0">
        <el-form :inline="true" :model="filterForm" class="filter-form">
          <el-form-item
            v-if="activeTab === 'repair'"
            label="报修设备"
            style="margin-bottom: 0"
          >
            <el-input
              v-model="filterForm.equipment"
              placeholder="请输入设备"
              clearable
              style="width: 150px"
            />
          </el-form-item>

          <el-form-item
            v-if="activeTab === 'repair'"
            label="地点"
            style="margin-bottom: 0"
          >
            <el-input
              v-model="filterForm.location"
              placeholder="请输入地点"
              clearable
              style="width: 150px"
            />
          </el-form-item>

          <el-form-item
            v-if="activeTab === 'report'"
            label="事项"
            style="margin-bottom: 0"
          >
            <el-input
              v-model="filterForm.title"
              placeholder="请输入事项"
              clearable
              style="width: 150px"
            />
          </el-form-item>

          <el-form-item label="提交时间" style="margin-bottom: 0">
            <el-date-picker
              v-model="filterForm.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              style="width: 240px"
            />
          </el-form-item>

          <el-form-item label="是否紧急" style="margin-bottom: 0">
            <el-select
              v-model="filterForm.isUrgent"
              placeholder="请选择"
              clearable
              style="width: 100px"
            >
              <el-option label="是" :value="true" />
              <el-option label="否" :value="false" />
            </el-select>
          </el-form-item>

          <el-form-item label="进度" style="margin-bottom: 0">
            <el-select
              v-model="filterForm.status"
              placeholder="请选择进度"
              clearable
              style="width: 120px"
            >
              <el-option label="未处理" value="pending" />
              <el-option label="处理中" value="processing" />
              <el-option label="已完成" value="completed" />
            </el-select>
          </el-form-item>

          <el-form-item style="margin-bottom: 0">
            <el-button type="primary" @click="handleSearch">查询</el-button>
            <el-button @click="handleReset">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 列表 -->
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
            <span style="font-weight: 600">{{
              activeTab === "repair" ? "报修" : "报事"
            }}</span>
            <span style="margin-left: 12px; color: #999"
              >共 {{ pagination.total }} 条</span
            >
          </div>
        </div>

        <div style="flex: 1; width: 100%; overflow: hidden">
          <!-- repair tab -->
          <div
            v-if="activeTab === 'repair'"
            style="height: 100%; display: flex; flex-direction: column"
          >
            <div
              v-if="hasPermission('repair')"
              style="flex: 1; overflow: hidden"
            >
              <el-table
                v-loading="loading"
                :data="tableData"
                stripe
                style="width: 100%"
                height="100%"
              >
                <el-table-column
                  prop="equipment"
                  label="报修设备"
                  min-width="140"
                />
                <el-table-column prop="location" label="地点" min-width="180" />
                <el-table-column
                  prop="description"
                  label="描述"
                  min-width="250"
                  show-overflow-tooltip
                >
                  <template #default="{ row }">
                    <el-tooltip
                      :content="row.description"
                      placement="top"
                      :disabled="row.description.length <= 30"
                    >
                      <span>{{ row.description }}</span>
                    </el-tooltip>
                  </template>
                </el-table-column>
                <el-table-column label="图片" min-width="120">
                  <template #default="{ row }">
                    <div
                      v-if="row.images && row.images.length > 0"
                      class="image-preview"
                    >
                      <img
                        v-for="(img, index) in row.images.slice(0, 3)"
                        :key="index"
                        :src="img"
                        @click="handlePreviewImages(row.images, index)"
                        style="
                          width: 30px;
                          height: 30px;
                          margin-right: 5px;
                          cursor: pointer;
                          object-fit: cover;
                          border-radius: 4px;
                        "
                      />
                      <span v-if="row.images.length > 3" class="more-images">
                        +{{ row.images.length - 3 }}
                      </span>
                    </div>
                    <span v-else class="no-data">无</span>
                  </template>
                </el-table-column>
                <el-table-column label="视频" min-width="80">
                  <template #default="{ row }">
                    <el-button
                      v-if="row.video"
                      link
                      type="primary"
                      size="small"
                      @click="handlePreviewVideo(row.video)"
                    >
                      预览
                    </el-button>
                    <span v-else class="no-data">无</span>
                  </template>
                </el-table-column>
                <el-table-column
                  prop="submitTime"
                  label="提交时间"
                  min-width="160"
                  sortable
                >
                  <template #default="{ row }">
                    {{ formatDate(row.submitTime) }}
                  </template>
                </el-table-column>
                <el-table-column label="是否紧急" min-width="90" align="center">
                  <template #default="{ row }">
                    <el-tag
                      :type="row.isUrgent ? 'danger' : 'info'"
                      size="small"
                    >
                      {{ row.isUrgent ? "是" : "否" }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="进度" min-width="90" align="center">
                  <template #default="{ row }">
                    <el-tag :type="getStatusType(row.status)" size="small">
                      {{ getStatusText(row.status) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column
                  prop="remark"
                  label="备注"
                  min-width="180"
                  show-overflow-tooltip
                >
                  <template #default="{ row }">
                    <el-tooltip
                      :content="row.remark || '无'"
                      placement="top"
                      :disabled="!row.remark || row.remark.length <= 20"
                    >
                      <span>{{ row.remark || "无" }}</span>
                    </el-tooltip>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="280" fixed="right">
                  <template #default="{ row }">
                    <el-button
                      type="primary"
                      size="small"
                      @click="handleViewDetail(row)"
                    >
                      查看详情
                    </el-button>
                    <el-button
                      type="success"
                      size="small"
                      @click="handleUpdateStatus(row)"
                    >
                      修改进度
                    </el-button>
                    <el-button
                      type="primary"
                      size="small"
                      @click="handleUpdateRemark(row)"
                    >
                      备注
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
            <div
              v-else
              style="
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
              "
            >
              <el-empty description="暂无权限" />
            </div>
          </div>

          <!-- report tab -->
          <div
            v-else-if="activeTab === 'report'"
            style="height: 100%; display: flex; flex-direction: column"
          >
            <div
              v-if="hasPermission('report')"
              style="flex: 1; overflow: hidden"
            >
              <el-table
                v-loading="loading"
                :data="tableData"
                stripe
                style="width: 100%"
                height="100%"
              >
                <el-table-column prop="title" label="事项" min-width="200" />
                <el-table-column
                  prop="description"
                  label="描述"
                  min-width="250"
                  show-overflow-tooltip
                >
                  <template #default="{ row }">
                    <el-tooltip
                      :content="row.description"
                      placement="top"
                      :disabled="row.description.length <= 30"
                    >
                      <span>{{ row.description }}</span>
                    </el-tooltip>
                  </template>
                </el-table-column>
                <el-table-column label="图片" min-width="120">
                  <template #default="{ row }">
                    <div
                      v-if="row.images && row.images.length > 0"
                      class="image-preview"
                    >
                      <img
                        v-for="(img, index) in row.images.slice(0, 3)"
                        :key="index"
                        :src="img"
                        @click="handlePreviewImages(row.images, index)"
                        style="
                          width: 30px;
                          height: 30px;
                          margin-right: 5px;
                          cursor: pointer;
                          object-fit: cover;
                          border-radius: 4px;
                        "
                      />
                      <span v-if="row.images.length > 3" class="more-images"
                        >+{{ row.images.length - 3 }}</span
                      >
                    </div>
                    <span v-else class="no-data">无</span>
                  </template>
                </el-table-column>
                <el-table-column label="视频" min-width="80">
                  <template #default="{ row }">
                    <el-button
                      v-if="row.video"
                      link
                      type="primary"
                      size="small"
                      @click="handlePreviewVideo(row.video)"
                      >预览</el-button
                    >
                    <span v-else class="no-data">无</span>
                  </template>
                </el-table-column>
                <el-table-column
                  prop="submitTime"
                  label="提交时间"
                  min-width="160"
                  sortable
                >
                  <template #default="{ row }">{{
                    formatDate(row.submitTime)
                  }}</template>
                </el-table-column>
                <el-table-column label="进度" min-width="90" align="center">
                  <template #default="{ row }">
                    <el-tag :type="getStatusType(row.status)" size="small">{{
                      getStatusText(row.status)
                    }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column
                  prop="remark"
                  label="备注"
                  min-width="180"
                  show-overflow-tooltip
                >
                  <template #default="{ row }">
                    <el-tooltip
                      :content="row.remark || '无'"
                      placement="top"
                      :disabled="!row.remark || row.remark.length <= 20"
                    >
                      <span>{{ row.remark || "无" }}</span>
                    </el-tooltip>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="280" fixed="right">
                  <template #default="{ row }">
                    <el-button
                      type="primary"
                      size="small"
                      @click="handleViewDetail(row)"
                      >查看详情</el-button
                    >
                    <el-button
                      type="success"
                      size="small"
                      @click="handleUpdateStatus(row)"
                      >修改进度</el-button
                    >
                    <el-button
                      type="primary"
                      size="small"
                      @click="handleUpdateRemark(row)"
                      >备注</el-button
                    >
                  </template>
                </el-table-column>
              </el-table>
            </div>
            <div
              v-else
              style="
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
              "
            >
              <el-empty description="暂无权限" />
            </div>
          </div>
        </div>
      </el-card>
    </template>

    <!-- 修改进度对话框 -->
    <el-dialog v-model="statusDialogVisible" title="修改进度" width="400px">
      <el-form :model="statusForm" label-width="80px">
        <el-form-item label="当前进度">
          <el-radio-group v-model="statusForm.status">
            <el-radio label="pending">未处理</el-radio>
            <el-radio label="processing">处理中</el-radio>
            <el-radio label="completed">已完成</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="statusDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmUpdateStatus">确定</el-button>
      </template>
    </el-dialog>

    <!-- 修改备注对话框 -->
    <el-dialog v-model="remarkDialogVisible" title="修改备注" width="500px">
      <el-form :model="remarkForm" label-width="80px">
        <el-form-item label="备注内容">
          <el-input
            v-model="remarkForm.remark"
            type="textarea"
            :rows="4"
            placeholder="请输入备注内容"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="remarkDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmUpdateRemark">确定</el-button>
      </template>
    </el-dialog>

    <!-- 视频预览对话框 -->
    <el-dialog v-model="videoDialogVisible" title="视频预览" width="800px">
      <video
        v-if="currentVideo"
        :src="currentVideo"
        controls
        style="width: 100%; max-height: 500px"
      />
    </el-dialog>

    <!-- 图片预览对话框 -->
    <el-dialog
      v-model="imagePreviewVisible"
      title=""
      fullscreen
      :close-on-click-modal="true"
      :show-close="true"
      class="image-preview-dialog"
      :modal="true"
    >
      <div class="preview-container" @click="imagePreviewVisible = false">
        <button
          v-if="previewImages.length > 1"
          class="preview-btn prev-btn"
          @click.stop="handlePrevImage"
        >
          ‹
        </button>
        <div class="preview-main">
          <img :src="previewImages[currentImageIndex]" class="preview-image" />
        </div>
        <button
          v-if="previewImages.length > 1"
          class="preview-btn next-btn"
          @click.stop="handleNextImage"
        >
          ›
        </button>
        <div v-if="previewImages.length > 1" class="preview-indicator">
          {{ currentImageIndex + 1 }} / {{ previewImages.length }}
        </div>
      </div>
    </el-dialog>

    <!-- 详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      :title="activeTab === 'repair' ? '报修详情' : '报事详情'"
      width="800px"
    >
      <div v-if="currentRow">
        <el-descriptions :column="2" border>
          <el-descriptions-item v-if="activeTab === 'repair'" label="报修设备">
            {{ currentRow.equipment }}
          </el-descriptions-item>
          <el-descriptions-item v-if="activeTab === 'repair'" label="地点">
            {{ currentRow.location }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="activeTab === 'report'"
            label="事项"
            :span="2"
          >
            {{ currentRow.title }}
          </el-descriptions-item>
          <el-descriptions-item label="提交时间" :span="2">
            {{ formatDate(currentRow.submitTime) }}
          </el-descriptions-item>
          <el-descriptions-item v-if="activeTab === 'repair'" label="是否紧急">
            <el-tag :type="currentRow.isUrgent ? 'danger' : 'info'">
              {{ currentRow.isUrgent ? "是" : "否" }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="当前进度">
            <el-tag :type="getStatusType(currentRow.status)">
              {{ getStatusText(currentRow.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">
            {{ currentRow.description }}
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">
            {{ currentRow.remark || "无" }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider />

        <div v-if="currentRow.images && currentRow.images.length > 0">
          <h4 style="margin-bottom: 12px">图片</h4>
          <div style="display: flex; flex-wrap: wrap; gap: 8px">
            <img
              v-for="(img, index) in currentRow.images"
              :key="index"
              :src="img"
              @click="handlePreviewImages(currentRow.images, index)"
              style="
                width: 100px;
                height: 100px;
                object-fit: cover;
                border-radius: 4px;
                cursor: pointer;
              "
            />
          </div>
        </div>

        <div v-if="currentRow.video" style="margin-top: 20px">
          <h4 style="margin-bottom: 12px">视频</h4>
          <video
            :src="currentRow.video"
            controls
            style="width: 100%; max-height: 400px; border-radius: 4px"
          />
        </div>
      </div>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch, computed } from "vue";
import { ElMessage } from "element-plus";
import request from "@/utils/axios";

// 权限检查
const userPermissions = ref<string[]>([]);
const userRole = ref<string>("");

function hasPermission(perm: string): boolean {
  // 总管理员拥有所有权限
  if (userRole.value === "super" || userRole.value === "admin") {
    return true;
  }
  return userPermissions.value.includes(perm);
}

const hasAnyPermission = computed(() => {
  return hasPermission("repair") || hasPermission("report");
});

function loadPermissions() {
  try {
    const raw = localStorage.getItem("admin-user");
    if (raw) {
      const user = JSON.parse(raw);
      userRole.value = user.role || "";
      userPermissions.value = user.permissions || [];
      // 根据权限设置默认tab
      if (!hasPermission("repair") && hasPermission("report")) {
        activeTab.value = "report";
      }
    }
  } catch (e) {
    console.error(e);
  }
}

// 页签 - 从 sessionStorage 恢复上次的状态
const savedTab = sessionStorage.getItem("repairManagement_activeTab");
const activeTab = ref<"repair" | "report">(
  (savedTab as "repair" | "report") || "repair",
);

// 筛选条件
const filterForm = reactive({
  equipment: "",
  location: "",
  title: "",
  dateRange: [] as string[],
  isUrgent: undefined as boolean | undefined,
  status: "",
});

// 表格数据
const loading = ref(false);
const tableData = ref<any[]>([]);

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
});

// 对话框
const statusDialogVisible = ref(false);
const remarkDialogVisible = ref(false);
const videoDialogVisible = ref(false);
const detailDialogVisible = ref(false);

const currentRow = ref<any>(null);
const currentVideo = ref("");

// 图片预览
const imagePreviewVisible = ref(false);
const previewImages = ref<string[]>([]);
const currentImageIndex = ref(0);

const statusForm = reactive({
  status: "",
});

const remarkForm = reactive({
  remark: "",
});

// 加载数据
const loadData = async () => {
  loading.value = true;
  try {
    const params: any = {
      page: pagination.page,
      pageSize: pagination.pageSize,
    };

    if (activeTab.value === "repair") {
      if (filterForm.equipment) params.equipment = filterForm.equipment;
      if (filterForm.location) params.location = filterForm.location;
    } else {
      if (filterForm.title) params.title = filterForm.title;
    }

    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.startDate = filterForm.dateRange[0];
      params.endDate = filterForm.dateRange[1];
    }

    if (filterForm.isUrgent !== undefined) {
      params.isUrgent = filterForm.isUrgent;
    }

    if (filterForm.status) {
      params.status = filterForm.status;
    }

    // 根据类型选择不同的接口路径
    const apiPath = activeTab.value === "repair" ? "/repairs" : "/reports";
    const response = await request.get(apiPath, { params });

    if (response.success) {
      tableData.value = response.data;
      pagination.total = response.total;
    } else {
      ElMessage.error(response.data.error || "加载失败");
    }
  } catch (error: any) {
    console.error("加载数据失败:", error);
    // 401错误会在拦截器中处理，这里不再显示
    if (error.response?.status !== 401) {
      ElMessage.error(
        error.response?.data?.error || error.message || "加载失败",
      );
    }
  } finally {
    loading.value = false;
  }
};

// 切换页签
const handleTabChange = () => {
  handleReset();
};

// 查询
const handleSearch = () => {
  pagination.page = 1;
  loadData();
};

// 重置
const handleReset = () => {
  filterForm.equipment = "";
  filterForm.location = "";
  filterForm.title = "";
  filterForm.dateRange = [];
  filterForm.isUrgent = undefined;
  filterForm.status = "";
  pagination.page = 1;
  loadData();
};

// 分页
const handleSizeChange = () => {
  pagination.page = 1;
  loadData();
};

const handlePageChange = () => {
  loadData();
};

// 查看详情
const handleViewDetail = (row: any) => {
  currentRow.value = row;
  detailDialogVisible.value = true;
};

// 修改进度
const handleUpdateStatus = (row: any) => {
  currentRow.value = row;
  statusForm.status = row.status;
  statusDialogVisible.value = true;
};

const confirmUpdateStatus = async () => {
  try {
    const apiPath = activeTab.value === "repair" ? "repairs" : "reports";
    await request.put(`/${apiPath}/${currentRow.value._id}`, {
      status: statusForm.status,
    });

    ElMessage.success("进度更新成功");
    statusDialogVisible.value = false;
    loadData();
  } catch (error: any) {
    console.error("更新进度失败:", error);
    ElMessage.error(error.message || "更新失败");
  }
};

// 修改备注
const handleUpdateRemark = (row: any) => {
  currentRow.value = row;
  remarkForm.remark = row.remark || "";
  remarkDialogVisible.value = true;
};

const confirmUpdateRemark = async () => {
  try {
    const apiPath = activeTab.value === "repair" ? "repairs" : "reports";
    await request.put(`/${apiPath}/${currentRow.value._id}`, {
      remark: remarkForm.remark,
    });

    ElMessage.success("备注更新成功");
    remarkDialogVisible.value = false;
    loadData();
  } catch (error: any) {
    console.error("更新备注失败:", error);
    ElMessage.error(error.message || "更新失败");
  }
};

// 预览视频
const handlePreviewVideo = (videoUrl: string) => {
  currentVideo.value = videoUrl;
  videoDialogVisible.value = true;
};

// 预览图片
const handlePreviewImages = (images: string[], index: number) => {
  previewImages.value = images;
  currentImageIndex.value = index;
  imagePreviewVisible.value = true;
};

// 上一张图片
const handlePrevImage = () => {
  if (currentImageIndex.value > 0) {
    currentImageIndex.value--;
  } else {
    currentImageIndex.value = previewImages.value.length - 1;
  }
};

// 下一张图片
const handleNextImage = () => {
  if (currentImageIndex.value < previewImages.value.length - 1) {
    currentImageIndex.value++;
  } else {
    currentImageIndex.value = 0;
  }
};

// 格式化日期
const formatDate = (date: string | Date) => {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// 获取状态类型
const getStatusType = (status: string) => {
  const map: Record<string, any> = {
    pending: "info",
    processing: "warning",
    completed: "success",
  };
  return map[status] || "info";
};

// 获取状态文本
const getStatusText = (status: string) => {
  const map: Record<string, string> = {
    pending: "未处理",
    processing: "处理中",
    completed: "已完成",
  };
  return map[status] || status;
};

// 监听 activeTab 变化，保存到 sessionStorage
watch(activeTab, (newTab) => {
  sessionStorage.setItem("repairManagement_activeTab", newTab);
});

onMounted(() => {
  loadPermissions();
  if (hasAnyPermission.value) {
    loadData();
  }
});
</script>

<style scoped lang="scss">
.filter-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.image-preview {
  display: flex;
  align-items: center;

  .more-images {
    font-size: 12px;
    color: #909399;
  }
}

.no-data {
  color: #909399;
  font-size: 12px;
}

.preview-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  cursor: pointer;
}

.preview-main {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  width: 100%;
}

.preview-image {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  display: block;
  user-select: none;
  pointer-events: none;
}

.preview-btn {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  font-size: 32px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  z-index: 10;

  &:hover {
    background: rgba(0, 0, 0, 0.7);
  }

  &.prev-btn {
    left: 40px;
  }

  &.next-btn {
    right: 40px;
  }
}

.preview-indicator {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 20px;
  font-size: 14px;
  color: #fff;
  z-index: 10;
}
</style>

<style>
/* 图片预览对话框样式 */
.image-preview-dialog {
  overflow: hidden !important;
}

.image-preview-dialog .el-dialog {
  background: transparent !important;
  box-shadow: none !important;
  margin: 0 !important;
  overflow: hidden !important;
}

.image-preview-dialog .el-overlay {
  background-color: rgba(0, 0, 0, 0.85) !important;
}

.image-preview-dialog .el-dialog__body {
  padding: 0 !important;
  height: 100vh !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: hidden !important;
}

.image-preview-dialog .el-dialog__header {
  display: none !important;
}

.image-preview-dialog .el-dialog__headerbtn {
  position: fixed !important;
  top: 20px !important;
  right: 20px !important;
  width: 50px !important;
  height: 50px !important;
  z-index: 9999 !important;
}

.image-preview-dialog .el-dialog__headerbtn .el-dialog__close {
  color: #fff !important;
  font-size: 32px !important;
}

.image-preview-dialog .el-dialog__headerbtn .el-dialog__close:hover {
  color: #409eff !important;
}
</style>
