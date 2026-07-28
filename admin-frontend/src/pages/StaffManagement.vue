<template>
  <div
    style="
      height: calc(100vh - 96px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    "
  >
    <!-- 搜索卡片 -->
    <el-card style="margin-bottom: 12px; flex-shrink: 0">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="姓名" style="margin-bottom: 0">
          <el-input
            v-model="filterForm.name"
            placeholder="请输入姓名"
            clearable
            style="width: 150px"
          />
        </el-form-item>
        <el-form-item label="手机号" style="margin-bottom: 0">
          <el-input
            v-model="filterForm.phone"
            placeholder="请输入手机号"
            clearable
            style="width: 150px"
          />
        </el-form-item>
        <el-form-item label="状态" style="margin-bottom: 0">
          <el-select
            v-model="filterForm.status"
            placeholder="请选择"
            clearable
            style="width: 120px"
          >
            <el-option label="全部" value="" />
            <el-option label="待审核" value="pending" />
            <el-option label="审核通过" value="approved" />
          </el-select>
        </el-form-item>
        <el-form-item style="margin-bottom: 0">
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 表格卡片 -->
    <el-card
      style="flex: 1; display: flex; flex-direction: column; overflow: hidden"
    >
      <!-- 工具栏 -->
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
          <span style="font-weight: 600">工作人员</span>
          <span style="margin-left: 12px; color: #999"
            >共 {{ pagination.total }} 条</span
          >
        </div>
        <el-button
          type="danger"
          :disabled="selectedIds.length === 0"
          @click="handleBatchDelete"
        >
          批量删除
        </el-button>
      </div>

      <!-- 表格 -->
      <div style="flex: 1; overflow: hidden">
        <el-table
          v-loading="loading"
          :data="tableData"
          stripe
          style="width: 100%"
          height="100%"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="55" />
          <el-table-column prop="name" label="姓名" min-width="120" />
          <el-table-column label="手机号" min-width="140">
            <template #default="{ row }">
              {{ maskPhone(row.phone) }}
            </template>
          </el-table-column>
          <el-table-column prop="position" label="职位" min-width="140" />
          <el-table-column label="状态" min-width="100" align="center">
            <template #default="{ row }">
              <el-tag
                :type="row.status === 'pending' ? 'warning' : 'success'"
                size="small"
              >
                {{ row.status === "pending" ? "待审核" : "审核通过" }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button
                type="primary"
                size="small"
                link
                @click="handleEdit(row)"
              >
                修改
              </el-button>
              <el-button
                type="danger"
                size="small"
                link
                @click="handleDelete(row)"
              >
                删除
              </el-button>
              <el-button
                v-if="row.status === 'pending'"
                type="success"
                size="small"
                link
                @click="handleApprove(row)"
              >
                审核
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 分页 -->
      <div
        style="
          margin-top: 16px;
          display: flex;
          justify-content: flex-end;
          flex-shrink: 0;
        "
      >
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 修改弹窗 -->
    <el-dialog v-model="editDialogVisible" title="编辑工作人员" width="500px">
      <el-form
        ref="editFormRef"
        :model="editForm"
        :rules="editRules"
        label-width="100px"
      >
        <el-form-item label="姓名" prop="name">
          <el-input v-model="editForm.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="editForm.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="职位" prop="position">
          <el-input v-model="editForm.position" placeholder="请输入职位" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSubmitting" @click="confirmEdit">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import request from "@/utils/axios";

// ==================== 社区信息 ====================
const communityId = ref<string>("");

function loadCommunityId() {
  try {
    const raw = localStorage.getItem("admin-user");
    if (raw) {
      const user = JSON.parse(raw);
      communityId.value = user.communityId || user._id || "";
    }
  } catch (e) {
    console.error("读取社区信息失败:", e);
  }
}

// ==================== 筛选条件 ====================
const filterForm = reactive({
  name: "",
  phone: "",
  status: "",
});

// ==================== 表格数据 ====================
const loading = ref(false);
const tableData = ref<any[]>([]);
const selectedIds = ref<string[]>([]);

// ==================== 分页 ====================
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
});

// ==================== 编辑弹窗 ====================
const editDialogVisible = ref(false);
const editSubmitting = ref(false);
const editFormRef = ref<FormInstance>();
const currentEditId = ref<string>("");

const editForm = reactive({
  name: "",
  phone: "",
  position: "",
});

const editRules: FormRules = {
  name: [{ required: true, message: "请输入姓名", trigger: "blur" }],
  phone: [
    { required: true, message: "请输入手机号", trigger: "blur" },
    {
      pattern: /^1[3-9]\d{9}$/,
      message: "请输入正确的手机号",
      trigger: "blur",
    },
  ],
  position: [{ required: true, message: "请输入职位", trigger: "blur" }],
};

// ==================== 工具函数 ====================
function maskPhone(phone: string): string {
  if (!phone || phone.length !== 11) return phone || "-";
  return phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
}

// ==================== 数据加载 ====================
async function loadData() {
  loading.value = true;
  try {
    const params: any = {
      communityId: communityId.value,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };

    if (filterForm.name) params.name = filterForm.name;
    if (filterForm.phone) params.phone = filterForm.phone;
    if (filterForm.status) params.status = filterForm.status;

    const response = await request.get("/staff", { params });

    if (response.success) {
      tableData.value = response.data;
      pagination.total = response.total;
    } else {
      ElMessage.error(response.message || "加载失败");
    }
  } catch (error: any) {
    console.error("加载工作人员列表失败:", error);
    if (error.response?.status !== 401) {
      ElMessage.error(
        error.response?.data?.error || error.message || "加载失败",
      );
    }
  } finally {
    loading.value = false;
  }
}

// ==================== 搜索/重置 ====================
function handleSearch() {
  pagination.page = 1;
  loadData();
}

function handleReset() {
  filterForm.name = "";
  filterForm.phone = "";
  filterForm.status = "";
  pagination.page = 1;
  loadData();
}

// ==================== 分页 ====================
function handleSizeChange() {
  pagination.page = 1;
  loadData();
}

function handlePageChange() {
  loadData();
}

// ==================== 多选 ====================
function handleSelectionChange(selection: any[]) {
  selectedIds.value = selection.map((item) => item._id);
}

// ==================== 修改 ====================
function handleEdit(row: any) {
  currentEditId.value = row._id;
  editForm.name = row.name;
  editForm.phone = row.phone;
  editForm.position = row.position || "";
  editDialogVisible.value = true;
}

async function confirmEdit() {
  if (!editFormRef.value) return;

  try {
    await editFormRef.value.validate();
  } catch {
    return;
  }

  editSubmitting.value = true;
  try {
    await request.put(`/staff/${currentEditId.value}`, {
      name: editForm.name,
      phone: editForm.phone,
      position: editForm.position,
      communityId: communityId.value,
    });

    ElMessage.success("修改成功");
    editDialogVisible.value = false;
    loadData();
  } catch (error: any) {
    console.error("修改失败:", error);
    ElMessage.error(error.response?.data?.error || error.message || "修改失败");
  } finally {
    editSubmitting.value = false;
  }
}

// ==================== 审核 ====================
async function handleApprove(row: any) {
  try {
    await ElMessageBox.confirm(
      `确认审核通过 ${row.name} 吗？`,
      "审核确认",
      {
        type: "warning",
        confirmButtonText: "确认",
        cancelButtonText: "取消",
      },
    );
  } catch {
    return;
  }

  try {
    await request.post(`/staff/${row._id}/approve`, {
      communityId: communityId.value,
    });

    ElMessage.success("审核通过");
    loadData();
  } catch (error: any) {
    console.error("审核失败:", error);
    ElMessage.error(error.response?.data?.error || error.message || "审核失败");
  }
}

// ==================== 删除 ====================
async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm("确认删除该工作人员记录？", "删除确认", {
      type: "warning",
      confirmButtonText: "确认",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }

  try {
    await request.delete(`/staff/${row._id}`);
    ElMessage.success("删除成功");

    // 如果删除后当前页无数据且不是第一页，回退到上一页
    if (tableData.value.length === 1 && pagination.page > 1) {
      pagination.page--;
    }
    loadData();
  } catch (error: any) {
    console.error("删除失败:", error);
    ElMessage.error(error.response?.data?.error || error.message || "删除失败");
  }
}

// ==================== 批量删除 ====================
async function handleBatchDelete() {
  if (selectedIds.value.length === 0) return;

  try {
    await ElMessageBox.confirm(
      `确认删除选中的 ${selectedIds.value.length} 条记录？`,
      "批量删除确认",
      {
        type: "warning",
        confirmButtonText: "确认",
        cancelButtonText: "取消",
      },
    );
  } catch {
    return;
  }

  try {
    await request.post("/staff/batch-delete", {
      ids: selectedIds.value,
      communityId: communityId.value,
    });

    const deleteCount = selectedIds.value.length;
    ElMessage.success(`成功删除 ${deleteCount} 条记录`);
    selectedIds.value = [];

    // 如果删除后当前页无数据且不是第一页，回退到上一页
    if (tableData.value.length <= deleteCount && pagination.page > 1) {
      pagination.page--;
    }
    loadData();
  } catch (error: any) {
    console.error("批量删除失败:", error);
    ElMessage.error(error.response?.data?.error || error.message || "批量删除失败");
  }
}

// ==================== 初始化 ====================
onMounted(() => {
  loadCommunityId();
  loadData();
});
</script>

<style scoped lang="scss">
.filter-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
</style>
