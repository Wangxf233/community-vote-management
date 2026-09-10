<template>
  <div class="certification-review-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <div style="display: flex; align-items: center; gap: 12px">
            <span>认证审核</span>
            <el-radio-group v-model="activeTab">
              <el-radio-button label="house">户主</el-radio-button>
              <el-radio-button label="shop">商铺</el-radio-button>
            </el-radio-group>
          </div>
        </div>
      </template>

      <!-- 户主 Tab：原有逻辑、页面完全保留 -->
      <div v-show="activeTab === 'house'">
        <el-form :inline="true" :model="searchForm" class="search-form">
          <el-form-item label="姓名">
            <el-input v-model="searchForm.name" placeholder="请输入姓名" clearable />
          </el-form-item>
          <el-form-item label="楼栋">
            <el-input v-model="searchForm.building" placeholder="请输入楼栋" clearable />
          </el-form-item>
          <el-form-item label="单元">
            <el-input v-model="searchForm.unit" placeholder="请输入单元" clearable />
          </el-form-item>
          <el-form-item label="房号">
            <el-input v-model="searchForm.room" placeholder="请输入房号" clearable />
          </el-form-item>
          <el-form-item label="认证状态">
            <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 120px">
              <el-option label="进行中" value="pending" />
              <el-option label="未通过" value="rejected" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="search">搜索</el-button>
            <el-button @click="resetSearch">重置</el-button>
          </el-form-item>
        </el-form>

        <div class="batch-operations" style="margin-bottom: 16px">
          <el-button type="success" :disabled="selectedRows.length === 0" @click="handleBatchApprove">
            批量通过
          </el-button>
          <el-button type="danger" :disabled="selectedRows.length === 0" @click="handleBatchDelete">
            批量删除
          </el-button>
          <span style="margin-left: 12px; color: #909399"> 已选择 {{ selectedRows.length }} 条 </span>
        </div>

        <el-table :data="applicationList" stripe style="width: 100%" @selection-change="handleSelectionChange">
          <el-table-column type="selection" width="55" />
          <el-table-column prop="name" label="户主姓名" min-width="100" />
          <el-table-column prop="phone" label="手机号" min-width="120" />
          <el-table-column prop="building" label="楼栋号" min-width="80" />
          <el-table-column prop="unit" label="单元号" min-width="80" />
          <el-table-column prop="room" label="房号" min-width="80">
            <template #default="{ row }">
              {{ formatRoom(row.room) }}
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="提交时间" min-width="160">
            <template #default="{ row }">
              {{ formatTime(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column prop="status" label="认证状态" min-width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'danger' : 'warning'">
                {{ row.status === "approved" ? "已通过" : row.status === "rejected" ? "未通过" : "进行中" }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ row }">
              <el-button v-if="row.status === 'pending'" type="primary" size="small" @click="handleReview(row)">
                审核
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          style="margin-top: 16px; justify-content: center"
          :pager-count="7"
          @size-change="loadList"
          @current-change="loadList"
        />
      </div>

      <!-- 商铺 Tab：全新业务页面 -->
      <div v-if="activeTab === 'shop'" style="max-height: calc(100vh - 250px); overflow-y: auto">
        <ShopCertificationTab />
      </div>
    </el-card>

    <!-- 审核对话框 -->
    <el-dialog v-model="reviewDialog" title="审核" width="500px">
      <el-form :model="reviewForm" label-width="100px">
        <el-form-item label="户主姓名">
          <span>{{ currentRow?.name }}</span>
        </el-form-item>
        <el-form-item label="房屋信息">
          <span> {{ currentRow?.building }}栋 {{ currentRow?.unit }}单元 {{ formatRoom(currentRow?.room) }}室 </span>
        </el-form-item>
        <el-form-item label="审核结果">
          <el-radio-group v-model="reviewForm.action">
            <el-radio label="approved">通过</el-radio>
            <el-radio label="rejected">不通过</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="reviewForm.action === 'rejected'" label="拒绝原因">
          <el-select v-model="reviewForm.reason" placeholder="请选择原因" style="width: 100%">
            <el-option label="姓名与房屋信息不匹配" value="name_mismatch" />
            <el-option label="自定义原因" value="custom" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="reviewForm.action === 'rejected' && reviewForm.reason === 'custom'" label="自定义原因">
          <el-input v-model="reviewForm.customReason" type="textarea" :rows="3" placeholder="请输入拒绝原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewDialog = false">取消</el-button>
        <el-button type="primary" @click="submitReview">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import request from "@/utils/axios";
import { formatRoom } from "@/utils/formatRoom";
import ShopCertificationTab from "./shop/ShopCertificationTab.vue";

// 页内子 Tab：户主（原有）/ 商铺（新业务）
const activeTab = ref<"house" | "shop">("house");

const applicationList = ref<any[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);
const selectedRows = ref<any[]>([]);

const searchForm = reactive({
  name: "",
  building: "",
  unit: "",
  room: "",
  status: "",
});

const reviewDialog = ref(false);
const currentRow = ref<any>(null);
const reviewForm = reactive({
  action: "approved",
  reason: "",
  customReason: "",
});

async function loadList() {
  try {
    const data = await request.get("/certification-applications", {
      params: {
        page: currentPage.value,
        pageSize: pageSize.value,
        ...searchForm,
      },
    });

    applicationList.value = data.data || [];
    total.value = data.total || 0;
  } catch (err) {
    console.error("加载申请列表失败:", err);
    ElMessage.error("加载失败");
  }
}

function search() {
  currentPage.value = 1;
  loadList();
}

function resetSearch() {
  searchForm.name = "";
  searchForm.building = "";
  searchForm.unit = "";
  searchForm.room = "";
  searchForm.status = "";
  search();
}

function handleReview(row: any) {
  currentRow.value = row;
  reviewForm.action = "approved";
  reviewForm.reason = "";
  reviewForm.customReason = "";
  reviewDialog.value = true;
}

async function submitReview() {
  try {
    if (reviewForm.action === "rejected" && !reviewForm.reason) {
      ElMessage.warning("请选择拒绝原因");
      return;
    }
    if (reviewForm.action === "rejected" && reviewForm.reason === "custom" && !reviewForm.customReason) {
      ElMessage.warning("请输入自定义原因");
      return;
    }

    let rejectReason = "";
    if (reviewForm.action === "rejected") {
      rejectReason = reviewForm.reason === "custom" ? reviewForm.customReason : "姓名与房屋信息不匹配";
    }

    await request.post(`/certification-applications/${currentRow.value._id}/review`, {
      action: reviewForm.action,
      reason: rejectReason,
    });

    ElMessage.success("审核成功");
    reviewDialog.value = false;
    loadList();
  } catch (err) {
    console.error("审核失败:", err);
    ElMessage.error("审核失败");
  }
}

function handleSelectionChange(selection: any[]) {
  selectedRows.value = selection;
}

async function handleBatchApprove() {
  if (selectedRows.value.length === 0) {
    ElMessage.warning("请选择要通过的申请");
    return;
  }

  try {
    await ElMessageBox.confirm(`确定要批量通过选中的 ${selectedRows.value.length} 条申请吗？`, "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });

    let successCount = 0;
    let failCount = 0;

    for (const row of selectedRows.value) {
      try {
        await request.post(`/certification-applications/${row._id}/review`, {
          action: "approved",
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      ElMessage.success(`成功通过 ${successCount} 条申请`);
    }
    if (failCount > 0) {
      ElMessage.warning(`${failCount} 条申请处理失败`);
    }

    loadList();
  } catch (err: any) {
    if (err !== "cancel") {
      console.error("批量通过失败:", err);
    }
  }
}

async function handleBatchDelete() {
  if (selectedRows.value.length === 0) {
    ElMessage.warning("请选择要删除的申请");
    return;
  }

  try {
    await ElMessageBox.confirm(`确定要批量删除选中的 ${selectedRows.value.length} 条申请吗？`, "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });

    let successCount = 0;
    let failCount = 0;

    for (const row of selectedRows.value) {
      try {
        await request.delete(`/certification-applications/${row._id}`);
        successCount++;
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      ElMessage.success(`成功删除 ${successCount} 条申请`);
    }
    if (failCount > 0) {
      ElMessage.warning(`${failCount} 条申请删除失败`);
    }

    loadList();
  } catch (err: any) {
    if (err !== "cancel") {
      console.error("批量删除失败:", err);
    }
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确定要删除 ${row.name} 的申请吗？`, "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });

    await request.delete(`/certification-applications/${row._id}`);
    ElMessage.success("删除成功");
    loadList();
  } catch (err: any) {
    if (err !== "cancel") {
      console.error("删除失败:", err);
      ElMessage.error("删除失败");
    }
  }
}

function formatTime(time: string) {
  if (!time) return "-";
  return new Date(time).toLocaleString("zh-CN");
}

onMounted(() => {
  loadList();
});
</script>

<style scoped>
.certification-review-page {
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-form {
  margin-bottom: 16px;
}
</style>
