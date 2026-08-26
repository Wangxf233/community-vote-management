<template>
  <div style="height: 100%; display: flex; flex-direction: column; overflow: hidden">
    <!-- 搜索卡片 -->
    <el-card style="margin-bottom: 12px; flex-shrink: 0">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="车牌号" style="margin-bottom: 0">
          <el-input v-model="filterForm.plateNumber" placeholder="请输入车牌号" clearable style="width: 180px" />
        </el-form-item>
        <el-form-item label="车主姓名" style="margin-bottom: 0">
          <el-input v-model="filterForm.ownerName" placeholder="请输入车主姓名" clearable style="width: 180px" />
        </el-form-item>
        <el-form-item label="车主电话" style="margin-bottom: 0">
          <el-input v-model="filterForm.ownerPhone" placeholder="请输入车主电话" clearable style="width: 180px" />
        </el-form-item>
        <el-form-item style="margin-bottom: 0">
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 工具栏 -->
    <el-card style="margin-bottom: 12px; flex-shrink: 0">
      <div style="display: flex; justify-content: space-between; align-items: center">
        <div style="display: flex; gap: 8px">
          <el-button type="primary" @click="handleAdd">添加车辆</el-button>
          <el-button type="danger" :disabled="selectedRows.length === 0" @click="handleBatchDelete">
            批量删除
          </el-button>
        </div>
        <div style="display: flex; gap: 8px">
          <el-button @click="handleExportTemplate">导出模板</el-button>
          <el-upload
            :action="importUrl"
            :headers="uploadHeaders"
            :show-file-list="false"
            accept=".xlsx,.xls"
            :before-upload="beforeImportUpload"
            :on-success="handleImportSuccess"
            :on-error="handleImportError"
          >
            <el-button type="primary">导入表格</el-button>
          </el-upload>
          <el-button type="primary" @click="handleExportExcel">导出Excel</el-button>
        </div>
      </div>
    </el-card>

    <!-- 表格卡片 -->
    <el-card style="flex: 1; display: flex; flex-direction: column; overflow: hidden">
      <div style="flex: 1; width: 100%; overflow: hidden">
        <el-table
          v-loading="loading"
          :data="tableData"
          stripe
          style="width: 100%"
          height="100%"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="55" />
          <el-table-column prop="vehicleType" label="车辆类型" width="100" />
          <el-table-column prop="plateNumber" label="车牌号" min-width="120" />

          <el-table-column prop="ownerName" label="车主姓名" min-width="100" />
          <el-table-column label="车主电话" min-width="130">
            <template #default="{ row }">
              {{ maskPhone(row.ownerPhone) }}
            </template>
          </el-table-column>
          <el-table-column prop="parkingFee" label="车位费" width="100" />
          <el-table-column prop="parkingSpot" label="车位编号" min-width="120" />
          <el-table-column prop="startDate" label="有效开始日期" width="120">
            <template #default="{ row }">
              {{ row.startDate || "-" }}
            </template>
          </el-table-column>
          <el-table-column prop="endDate" label="有效结束日期" width="120">
            <template #default="{ row }">
              {{ row.endDate || "-" }}
            </template>
          </el-table-column>
          <el-table-column prop="building" label="栋单元房号" min-width="140" show-overflow-tooltip />
          <el-table-column label="违停次数" width="100" align="center">
            <template #default="{ row }">
              <el-link v-if="row.violationCount > 0" type="primary" @click="openViolations(row)">
                {{ row.violationCount }}
              </el-link>
              <span v-else style="color: #999">0</span>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="handleEdit(row)"> 修改 </el-button>
              <el-button type="danger" size="small" @click="handleDelete(row)"> 删除 </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 分页 -->
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 16px; justify-content: center; flex-shrink: 0"
        @size-change="handleSearch"
        @current-change="fetchList"
      />
    </el-card>

    <!-- 添加/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑车辆' : '添加车辆'" width="650px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="车辆类型" prop="vehicleType">
              <el-input v-model="form.vehicleType" placeholder="如：小轿车" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="车牌号" prop="plateNumber">
              <el-input v-model="form.plateNumber" placeholder="请输入车牌号" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="车主姓名" prop="ownerName">
              <el-input v-model="form.ownerName" placeholder="请输入车主姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="车主电话" prop="ownerPhone">
              <el-input v-model="form.ownerPhone" placeholder="请输入手机号" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="车位费" prop="parkingFee">
              <el-input v-model="form.parkingFee" placeholder="请输入车位费" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="车位编号" prop="parkingSpot">
              <el-input v-model="form.parkingSpot" placeholder="请输入车位编号" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="有效开始日期" prop="startDate">
              <el-date-picker
                v-model="form.startDate"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="有效结束日期" prop="endDate">
              <el-date-picker
                v-model="form.endDate"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="24">
            <el-form-item label="栋单元房号" prop="building">
              <el-input v-model="form.building" placeholder="请输入栋单元房号，如 15-1-602" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="24">
            <el-form-item label="备注" prop="remark">
              <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="请输入备注" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit"> 确定 </el-button>
      </template>
    </el-dialog>

    <!-- 违停详情弹窗 -->
    <el-dialog v-model="violationDialogVisible" title="违停详情" width="640px">
      <div style="margin-bottom: 12px; color: #606266">
        车牌号：{{ violationPlate }}（共 {{ violations.length }} 次违停）
      </div>
      <el-table :data="violations" stripe max-height="420" v-loading="violationLoading">
        <el-table-column label="次数" width="80" align="center">
          <template #default="{ row }">{{ row.seq }}</template>
        </el-table-column>
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="照片" min-width="140">
          <template #default="{ row }">
            <el-image
              v-if="row.photoUrl"
              :src="row.photoUrl"
              :preview-src-list="[row.photoUrl]"
              preview-teleported
              fit="cover"
              style="width: 80px; height: 60px; border-radius: 4px"
            />
            <span v-else style="color: #999">无</span>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="violationDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 导入失败明细弹窗 -->
    <el-dialog v-model="failDialogVisible" title="导入失败明细" width="600px">
      <el-table :data="failList" stripe max-height="400">
        <el-table-column prop="row" label="行号" width="80" />
        <el-table-column prop="plateNumber" label="车牌号" min-width="120" />
        <el-table-column prop="reason" label="失败原因" min-width="200" show-overflow-tooltip />
      </el-table>
      <template #footer>
        <el-button @click="failDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import request from "@/utils/axios";

// --- 用户信息 ---
function getCommunityId(): string {
  try {
    const raw = localStorage.getItem("admin-user");
    if (raw) {
      const user = JSON.parse(raw);
      return user.communityId || "";
    }
  } catch (e) {
    console.error("获取用户信息失败:", e);
  }
  return "";
}

const communityId = getCommunityId();
const token = localStorage.getItem("admin-token") || "";
const importUrl = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/vehicles/import`
  : "/api/vehicles/import";
const uploadHeaders = { Authorization: `Bearer ${token}` };

// --- 筛选 ---
const filterForm = reactive({
  plateNumber: "",
  ownerName: "",
  ownerPhone: "",
});

// --- 表格 ---
const loading = ref(false);
const tableData = ref<any[]>([]);
const selectedRows = ref<any[]>([]);
const pagination = reactive({ page: 1, pageSize: 20, total: 0 });

function handleSelectionChange(rows: any[]) {
  selectedRows.value = rows;
}

// --- 数据加载 ---
async function fetchList() {
  loading.value = true;
  try {
    const params: any = {
      communityId,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
    if (filterForm.plateNumber) params.plateNumber = filterForm.plateNumber;
    if (filterForm.ownerName) params.ownerName = filterForm.ownerName;
    if (filterForm.ownerPhone) params.ownerPhone = filterForm.ownerPhone;

    const res = await request.get("/vehicles", { params });
    tableData.value = res.data;
    pagination.total = res.total;
  } catch (error: any) {
    if (error.response?.status !== 401) {
      ElMessage.error(error.response?.data?.error || "获取列表失败");
    }
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pagination.page = 1;
  fetchList();
}

function handleReset() {
  filterForm.plateNumber = "";
  filterForm.ownerName = "";
  filterForm.ownerPhone = "";
  handleSearch();
}

// --- 对话框 & 表单 ---
const dialogVisible = ref(false);
const isEdit = ref(false);
const submitting = ref(false);
const currentRow = ref<any>(null);
const formRef = ref<FormInstance>();

const initForm = () => ({
  vehicleType: "",
  plateNumber: "",
  ownerName: "",
  ownerPhone: "",
  parkingFee: "",
  parkingSpot: "",
  startDate: "",
  endDate: "",
  building: "",
  remark: "",
});

const form = reactive(initForm());

const formRules: FormRules = {
  plateNumber: [{ required: true, message: "请输入车牌号", trigger: "blur" }],
  ownerPhone: [
    { required: true, message: "请输入车主电话", trigger: "blur" },
    { pattern: /^1[3-9]\d{9}$/, message: "请输入正确的手机号", trigger: "blur" },
  ],
};

function handleAdd() {
  isEdit.value = false;
  currentRow.value = null;
  Object.assign(form, initForm());
  dialogVisible.value = true;
}

function handleEdit(row: any) {
  isEdit.value = true;
  currentRow.value = row;
  Object.assign(form, {
    vehicleType: row.vehicleType || "",
    plateNumber: row.plateNumber || "",
    ownerName: row.ownerName || "",
    ownerPhone: row.ownerPhone || "",
    parkingFee: row.parkingFee ?? "",
    parkingSpot: row.parkingSpot || "",
    startDate: row.startDate ? formatDate(row.startDate) : "",
    endDate: row.endDate ? formatDate(row.endDate) : "",
    building: row.building || "",
    remark: row.remark || "",
  });
  dialogVisible.value = true;
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  submitting.value = true;
  try {
    const payload = { ...form, communityId };
    if (isEdit.value && currentRow.value) {
      await request.put(`/vehicles/${currentRow.value._id}`, payload);
      ElMessage.success("修改成功");
    } else {
      await request.post("/vehicles", payload);
      ElMessage.success("添加成功");
    }
    dialogVisible.value = false;
    fetchList();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || "操作失败");
  } finally {
    submitting.value = false;
  }
}

// --- 删除 ---
async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm("确认删除该车辆记录？", "提示", { type: "warning" });
    await request.delete(`/vehicles/${row._id}`);
    ElMessage.success("删除成功");
    fetchList();
  } catch (error: any) {
    if (error !== "cancel") {
      ElMessage.error(error.response?.data?.error || "删除失败");
    }
  }
}

async function handleBatchDelete() {
  if (selectedRows.value.length === 0) return;
  try {
    await ElMessageBox.confirm(`确认删除选中的 ${selectedRows.value.length} 条车辆记录？`, "提示", { type: "warning" });
    const ids = selectedRows.value.map((r) => r._id);
    await request.post("/vehicles/batch-delete", { ids, communityId });
    ElMessage.success("批量删除成功");
    selectedRows.value = [];
    fetchList();
  } catch (error: any) {
    if (error !== "cancel") {
      ElMessage.error(error.response?.data?.error || "删除失败");
    }
  }
}

// --- 导出模板 ---
function handleExportTemplate() {
  window.open(
    `${import.meta.env.VITE_API_BASE_URL || "/api"}/vehicles/template?communityId=${encodeURIComponent(communityId)}&token=${encodeURIComponent(token)}`,
  );
}

// --- 导出 Excel ---
async function handleExportExcel() {
  try {
    const params: any = { communityId };
    if (filterForm.plateNumber) params.plateNumber = filterForm.plateNumber;
    if (filterForm.ownerName) params.ownerName = filterForm.ownerName;
    if (filterForm.ownerPhone) params.ownerPhone = filterForm.ownerPhone;

    const res = await request.get("/vehicles/export", {
      params,
      responseType: "blob",
    });
    const blob = new Blob([res], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `车辆信息_${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
    ElMessage.success("导出成功");
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || "导出失败");
  }
}

// --- 违停详情 ---
const violationDialogVisible = ref(false);
const violationPlate = ref("");
const violations = ref<any[]>([]);
const violationLoading = ref(false);

async function openViolations(row: any) {
  violationPlate.value = row.plateNumber || "";
  violations.value = [];
  violationDialogVisible.value = true;
  violationLoading.value = true;
  try {
    const res = await request.get("/vehicles/violations", {
      params: { communityId, plateNumber: row.plateNumber },
    });
    violations.value = res.data || [];
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || "加载违停详情失败");
  } finally {
    violationLoading.value = false;
  }
}

function formatDateTime(val: string): string {
  if (!val) return "-";
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

// --- 导入 ---
const failDialogVisible = ref(false);
const failList = ref<any[]>([]);

function beforeImportUpload(file: File) {
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    ElMessage.error("Excel 文件大小不能超过 10MB");
    return false;
  }
  return true;
}

function handleImportSuccess(response: any) {
  const res = response.data || response;
  const addCount = res.addCount || 0;
  const updateCount = res.updateCount || 0;
  const failCount = res.failCount || 0;
  const fails = res.failDetails || [];

  if (addCount + updateCount > 0) {
    ElMessage.success(`导入完成：新增 ${addCount} 条，更新 ${updateCount} 条`);
  }
  if (failCount > 0) {
    failList.value = fails;
    failDialogVisible.value = true;
  }
  fetchList();
}

function handleImportError() {
  ElMessage.error("导入失败，请检查文件格式");
}

// --- 工具函数 ---
function maskPhone(phone: string): string {
  if (!phone || phone.length !== 11) return phone || "-";
  return phone.slice(0, 3) + "****" + phone.slice(7);
}

function formatDate(date: string): string {
  if (!date) return "-";
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
