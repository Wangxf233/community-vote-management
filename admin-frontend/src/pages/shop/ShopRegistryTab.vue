<template>
  <div class="shop-registry-tab">
    <!-- 顶部操作按钮（下载导入模板/导入Excel/手动添加）由父页面卡片头部渲染，与户主页位置一致 -->

    <!-- 筛选条件区 -->
    <el-form :inline="true" :model="searchForm" class="search-form">
      <el-form-item label="姓名">
        <el-input v-model="searchForm.name" placeholder="请输入姓名" clearable />
      </el-form-item>
      <el-form-item label="门牌号">
        <el-input v-model="searchForm.houseNumber" placeholder="请输入门牌号" clearable />
      </el-form-item>
      <el-form-item label="商铺名">
        <el-input v-model="searchForm.shopName" placeholder="请输入商铺名" clearable />
      </el-form-item>
      <el-form-item label="导入状态">
        <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 120px">
          <el-option label="有效" value="valid" />
          <el-option label="无效" value="invalid" />
        </el-select>
      </el-form-item>
      <el-form-item label="注册认证状态">
        <el-select v-model="searchForm.certStatus" placeholder="全部" clearable style="width: 120px">
          <el-option label="未申请" value="none" />
          <el-option label="已通过" value="approved" />
          <el-option label="进行中" value="pending" />
          <el-option label="未通过" value="rejected" />
        </el-select>
      </el-form-item>
      <el-form-item label="实名认证状态">
        <el-select v-model="searchForm.realNameStatus" placeholder="全部" clearable style="width: 120px">
          <el-option label="已实名" value="verified" />
          <el-option label="进行中" value="pending" />
          <el-option label="未实名" value="unverified" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="search">搜索</el-button>
        <el-button @click="resetSearch">重置</el-button>
      </el-form-item>
    </el-form>

    <!-- 数据列表区 -->
    <div class="batch-operations" style="margin-bottom: 16px">
      <el-button type="danger" :disabled="selectedRows.length === 0" @click="handleBatchDelete"> 删除 </el-button>
      <span style="margin-left: 12px; color: #909399"> 已选择 {{ selectedRows.length }} 个业主 </span>
    </div>

    <el-table :data="registryList" stripe style="width: 100%" row-key="_id" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" />
      <el-table-column prop="ownerName1" label="户主姓名" min-width="100" />
      <el-table-column prop="houseNumber" label="门牌号" min-width="100">
        <template #default="{ row }">
          {{ row.houseNumber || "-" }}
        </template>
      </el-table-column>
      <el-table-column prop="shopName" label="商铺名" min-width="120">
        <template #default="{ row }">
          {{ row.shopName || "-" }}
        </template>
      </el-table-column>
      <el-table-column prop="area" label="专有面积(㎡)" min-width="120" />
      <el-table-column prop="remark" label="备注" min-width="120">
        <template #default="{ row }">
          {{ row.remark || "-" }}
        </template>
      </el-table-column>
      <el-table-column prop="status" label="导入状态" min-width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'valid' ? 'success' : 'danger'">
            {{ row.status === "valid" ? "有效" : "无效" }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="registrationStatus" label="注册认证状态" min-width="120">
        <template #default="{ row }">
          <el-tag
            :type="
              row.registrationStatus === 'approved'
                ? 'success'
                : row.registrationStatus === 'rejected'
                  ? 'danger'
                  : row.registrationStatus === 'pending'
                    ? 'warning'
                    : 'info'
            "
          >
            {{
              row.registrationStatus === "approved"
                ? "已通过"
                : row.registrationStatus === "rejected"
                  ? "未通过"
                  : row.registrationStatus === "pending"
                    ? "进行中"
                    : "未申请"
            }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="realNameStatusValue" label="实名认证状态" min-width="120">
        <template #default="{ row }">
          <el-tag
            :type="
              row.realNameStatusValue === 'verified'
                ? 'success'
                : row.realNameStatusValue === 'pending'
                  ? 'warning'
                  : 'info'
            "
          >
            {{
              row.realNameStatusValue === "verified"
                ? "已实名"
                : row.realNameStatusValue === "pending"
                  ? "进行中"
                  : "未实名"
            }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="handleEdit(row)"> 编辑 </el-button>
          <el-button type="warning" size="small" @click="handleRealNameReview(row)"> 审核认证 </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :total="total"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next, jumper"
      style="padding: 16px 0; justify-content: center"
      :pager-count="7"
      @size-change="loadList"
      @current-change="loadList"
    />

    <!-- 添加/编辑对话框（表单字段与导入模板一致：户主姓名、门牌号、商铺名、专有面积、备注） -->
    <el-dialog v-model="editDialog" :title="editForm.id ? '编辑商铺信息' : '添加商铺信息'" width="600px">
      <el-form ref="formRef" :model="editForm" label-width="120px" :rules="formRules">
        <el-form-item label="户主姓名" prop="ownerName1">
          <el-input v-model="editForm.ownerName1" placeholder="必填" />
        </el-form-item>
        <el-form-item label="门牌号" prop="houseNumber">
          <el-input v-model="editForm.houseNumber" placeholder="选填" />
        </el-form-item>
        <el-form-item label="商铺名" prop="shopName">
          <el-input v-model="editForm.shopName" placeholder="选填" />
        </el-form-item>
        <el-form-item label="专有面积" prop="area">
          <el-input v-model="editForm.area" placeholder="必填，例如：50" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="editForm.remark" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialog = false">取消</el-button>
        <el-button type="primary" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 导入结果对话框 -->
    <el-dialog v-model="importDialog" title="导入结果" width="700px">
      <div class="import-result">
        <el-result
          :icon="importResult.success ? 'success' : 'warning'"
          :title="importResult.title"
          :sub-title="importResult.message"
        >
          <template #extra>
            <el-descriptions :column="3" border>
              <el-descriptions-item label="新增">
                <span style="color: #67c23a; font-weight: bold">{{ importResult.addCount }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="跳过">
                <span style="color: #e6a23c; font-weight: bold">{{ importResult.skipCount }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="失败">
                <span style="color: #f56c6c; font-weight: bold">{{ importResult.failCount }}</span>
              </el-descriptions-item>
            </el-descriptions>
            <div v-if="importResult.skipped && importResult.skipped.length > 0" class="skip-list">
              <el-divider content-position="left">跳过记录（已存在）</el-divider>
              <el-table :data="importResult.skipped" max-height="200">
                <el-table-column prop="row" label="行号" width="80" />
                <el-table-column prop="info" label="说明" />
              </el-table>
            </div>
            <div v-if="importResult.errors && importResult.errors.length > 0" class="error-list">
              <el-divider content-position="left">错误详情</el-divider>
              <el-table :data="importResult.errors" max-height="200">
                <el-table-column prop="row" label="行号" width="80" />
                <el-table-column prop="error" label="错误信息" />
              </el-table>
            </div>
          </template>
        </el-result>
      </div>
      <template #footer>
        <el-button type="primary" @click="importDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 商铺实名认证审核对话框 -->
    <el-dialog v-model="realNameDialog" title="实名认证审核" width="900px">
      <div class="realname-review">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="户主姓名">
            {{ realNameForm.ownerName1 }}
          </el-descriptions-item>
          <el-descriptions-item label="提交时间">
            {{ realNameForm.submitTime }}
          </el-descriptions-item>
          <el-descriptions-item label="商铺信息">
            {{ realNameForm.houseNumber || "-" }} / {{ realNameForm.shopName || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="证件类型">
            {{ realNameForm.certTypeName }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">认证资料</el-divider>

        <div class="cert-images">
          <div class="image-group">
            <div class="image-label">身份证人像面</div>
            <el-image
              :src="realNameForm.idCardFront"
              fit="contain"
              :preview-src-list="[realNameForm.idCardFront]"
              class="cert-image"
            />
          </div>

          <div class="image-group">
            <div class="image-label">身份证国徽面</div>
            <el-image
              :src="realNameForm.idCardBack"
              fit="contain"
              :preview-src-list="[realNameForm.idCardBack]"
              class="cert-image"
            />
          </div>

          <div class="image-group">
            <div class="image-label">{{ realNameForm.certTypeName }}</div>
            <el-image
              :src="realNameForm.certImage"
              fit="contain"
              :preview-src-list="[realNameForm.certImage]"
              class="cert-image"
            />
          </div>
        </div>

        <el-divider content-position="left">审核结果</el-divider>

        <el-form label-width="100px">
          <el-form-item label="审核状态">
            <el-radio-group v-model="realNameForm.reviewStatus">
              <el-radio label="approved">通过</el-radio>
              <el-radio label="rejected">拒绝</el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item v-if="realNameForm.reviewStatus === 'rejected'" label="拒绝原因">
            <el-input v-model="realNameForm.rejectReason" type="textarea" :rows="3" placeholder="请输入拒绝原因" />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="realNameDialog = false">取消</el-button>
        <el-button type="primary" :loading="reviewing" @click="submitRealNameReview">提交审核</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, h } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Loading } from "@element-plus/icons-vue";
import * as XLSX from "xlsx";
import request from "@/utils/axios";

const registryList = ref<any[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);
const selectedRows = ref<any[]>([]);
const importing = ref(false);

const searchForm = reactive({
  name: "",
  houseNumber: "",
  shopName: "",
  status: "",
  certStatus: "",
  realNameStatus: "",
});

const editDialog = ref(false);
const editForm = reactive({
  id: "",
  ownerName1: "",
  houseNumber: "",
  shopName: "",
  area: "",
  remark: "",
  status: "valid",
});

const formRules = {
  ownerName1: [{ required: true, message: "请输入户主姓名", trigger: "blur" }],
  area: [{ required: true, message: "请输入专有面积", trigger: "blur" }],
};

const formRef = ref();

const importDialog = ref(false);
const importResult = reactive({
  success: false,
  title: "",
  message: "",
  addCount: 0,
  skipCount: 0,
  failCount: 0,
  errors: [] as any[],
  skipped: [] as any[],
});

const realNameDialog = ref(false);
const reviewing = ref(false);
const realNameForm = reactive({
  id: "",
  ownerName1: "",
  houseNumber: "",
  shopName: "",
  submitTime: "",
  idCardFront: "",
  idCardBack: "",
  certType: "",
  certTypeName: "",
  certImage: "",
  reviewStatus: "approved",
  rejectReason: "",
});

async function loadList() {
  try {
    const params: any = {
      page: currentPage.value,
      pageSize: pageSize.value,
      ...searchForm,
    };

    const data = await request.get("/shop-registry", { params });
    registryList.value = data.data || [];
    total.value = data.total || 0;
  } catch (err) {
    ElMessage.error("加载失败");
  }
}

function search() {
  currentPage.value = 1;
  loadList();
}

function resetSearch() {
  searchForm.name = "";
  searchForm.houseNumber = "";
  searchForm.shopName = "";
  searchForm.status = "";
  searchForm.certStatus = "";
  searchForm.realNameStatus = "";
  search();
}

// 下载商铺导入模板：户主姓名【必填】、门牌号【选填】、商铺名【选填】、专有面积【必填】、备注【选填】
function downloadTemplate() {
  const template = [
    ["【提示：以下示例说明和示例数据不会被导入，不要删除1-8行内容】"],
    ["示例说明："],
    ["1. 每行一条商铺记录；户主姓名、专有面积必填，门牌号、商铺名、备注选填"],
    [""],
    ["户主姓名 *", "门牌号", "商铺名", "专有面积 *", "备注（如无，留空）"],
    ["张三", "12号", "张记便利店", "50", ""],
    ["李四", "", "李记五金", "80", "转角商铺"],
    ["王五", "8号", "", "30", ""],
  ];

  const ws = XLSX.utils.aoa_to_sheet(template);

  // 设置列宽
  const colWidths = [
    { wch: 16 }, // 户主姓名
    { wch: 12 }, // 门牌号
    { wch: 16 }, // 商铺名
    { wch: 14 }, // 专有面积
    { wch: 22 }, // 备注
  ];
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "商铺名册");
  XLSX.writeFile(wb, "商铺名册导入模板.xlsx");
}

async function handleImport(file: File) {
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    ElMessage.error("Excel 文件大小不能超过 10MB");
    return false;
  }

  importing.value = true;
  const loading = ElMessage({
    message: "正在导入，请稍候...",
    type: "info",
    duration: 0,
    icon: h(Loading),
  });

  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
      }) as any[][];

      // 跳过前8行（提示1行、说明2行、空行1行、表头1行、示例数据3行）
      const rows = jsonData.slice(8).filter((row) => row.length > 0);

      // 商铺记录扁平：每行一条记录，无多房产合并逻辑
      const importData = rows.map((row, index) => ({
        ownerName1: row[0]?.toString() || "",
        houseNumber: row[1]?.toString() || "",
        shopName: row[2]?.toString() || "",
        area: row[3]?.toString() || "",
        remark: row[4]?.toString() || "",
        rowNumber: index + 9,
      }));

      const totalCount = importData.length;

      // 分批导入，每批100条
      const batchSize = 100;
      const batches = [];
      for (let i = 0; i < importData.length; i += batchSize) {
        batches.push(importData.slice(i, i + batchSize));
      }

      loading.close();
      const progressLoading = ElMessage({
        message: `准备导入 ${totalCount} 条数据，共 ${batches.length} 批...`,
        type: "info",
        duration: 0,
        icon: h(Loading),
      });

      // 汇总结果
      let totalAdded = 0;
      let totalSkipped = 0;
      let totalFailed = 0;
      const allErrors: any[] = [];
      const allSkipped: any[] = [];

      // 逐批导入
      for (let i = 0; i < batches.length; i++) {
        progressLoading.close();
        const currentProgress = ElMessage({
          message: `正在导入第 ${i + 1}/${batches.length} 批 (${Math.round(((i + 1) / batches.length) * 100)}%)...`,
          type: "info",
          duration: 0,
          icon: h(Loading),
        });

        try {
          const result = await request.post(
            "/shop-registry/import",
            { data: batches[i] },
            { timeout: 60000 }, // 单批次超时60秒
          );

          totalAdded += result.addCount || 0;
          totalSkipped += result.skipCount || 0;
          totalFailed += result.failCount || 0;

          if (result.errors && result.errors.length > 0) {
            allErrors.push(...result.errors);
          }
          if (result.skipped && result.skipped.length > 0) {
            allSkipped.push(...result.skipped);
          }
        } catch (err: any) {
          // 某批次失败，记录错误
          totalFailed += batches[i].length;
          allErrors.push({
            row: `批次 ${i + 1}`,
            error: err.message || "导入失败",
          });
        }

        currentProgress.close();
      }

      importing.value = false;

      // 显示汇总结果
      importResult.success = totalFailed < totalCount;
      importResult.title = "导入完成";
      importResult.message = `总计 ${totalCount} 条，新增 ${totalAdded} 条，跳过 ${totalSkipped} 条，失败 ${totalFailed} 条`;
      importResult.addCount = totalAdded;
      importResult.skipCount = totalSkipped;
      importResult.failCount = totalFailed;
      importResult.errors = allErrors;
      importResult.skipped = allSkipped;
      importDialog.value = true;
      loadList();
    } catch (err: any) {
      loading.close();
      importing.value = false;
      ElMessage.error("导入失败: " + err.message);
    }
  };

  reader.onerror = () => {
    loading.close();
    importing.value = false;
    ElMessage.error("文件读取失败，请重新选择文件");
  };

  reader.readAsArrayBuffer(file);
  return false; // 阻止自动上传
}

function showAddDialog() {
  editForm.id = "";
  editForm.ownerName1 = "";
  editForm.houseNumber = "";
  editForm.shopName = "";
  editForm.area = "";
  editForm.remark = "";
  editForm.status = "valid";
  editDialog.value = true;
}

function handleEdit(row: any) {
  editForm.id = row._id;
  editForm.ownerName1 = row.ownerName1 || "";
  editForm.houseNumber = row.houseNumber || "";
  editForm.shopName = row.shopName || "";
  editForm.area = row.area ?? "";
  editForm.remark = row.remark || "";
  editForm.status = row.status || "valid";
  editDialog.value = true;
}

async function submitEdit() {
  try {
    await formRef.value.validate();

    // 准备提交数据
    const submitData = {
      id: editForm.id,
      ownerName1: editForm.ownerName1,
      houseNumber: editForm.houseNumber,
      shopName: editForm.shopName,
      area: editForm.area,
      remark: editForm.remark,
      status: editForm.status,
    };

    if (editForm.id) {
      await request.put(`/shop-registry/${editForm.id}`, submitData);
    } else {
      await request.post("/shop-registry", submitData);
    }

    ElMessage.success(editForm.id ? "修改成功" : "添加成功");
    editDialog.value = false;
    loadList();
  } catch (err: any) {
    // 显示错误信息
    if (err.response && err.response.data && err.response.data.error) {
      ElMessage.error(err.response.data.error);
    } else if (err.message) {
      ElMessage.error(err.message);
    } else {
      ElMessage.error(editForm.id ? "修改失败" : "添加失败");
    }
  }
}

function handleSelectionChange(selection: any[]) {
  selectedRows.value = selection;
}

async function handleBatchDelete() {
  if (selectedRows.value.length === 0) {
    ElMessage.warning("请先选择要删除的记录");
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedRows.value.length} 条商铺记录吗？此操作不可恢复！`,
      "批量删除确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      },
    );

    const deletePromises = selectedRows.value.map((row) =>
      request
        .delete(`/shop-registry/${row._id}`)
        .then(() => ({ success: true }))
        .catch(() => ({ success: false })),
    );

    const results = await Promise.all(deletePromises);
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    if (failCount === 0) {
      ElMessage.success(`成功删除 ${successCount} 条商铺记录`);
    } else {
      ElMessage.warning(`删除完成：成功 ${successCount} 条，失败 ${failCount} 条`);
    }

    selectedRows.value = [];
    loadList();
  } catch (err: any) {
    if (err !== "cancel") {
      ElMessage.error("批量删除失败");
    }
  }
}

// 处理商铺实名认证审核
function handleRealNameReview(row: any) {
  // 检查是否已提交审核信息
  if (row.realNameStatus !== "pending") {
    ElMessage.info("该业主暂未提交实名认证审核信息");
    return;
  }

  const certTypeMap: any = {
    property: "房产证",
    contract: "购房合同",
    payment: "缴费证明",
  };

  realNameForm.id = row._id;
  realNameForm.ownerName1 = row.ownerName1;
  realNameForm.houseNumber = row.houseNumber || "";
  realNameForm.shopName = row.shopName || "";
  realNameForm.submitTime = row.realNameSubmitTime || "";
  realNameForm.idCardFront = row.realNameIdCardFront || "";
  realNameForm.idCardBack = row.realNameIdCardBack || "";
  realNameForm.certType = row.realNameCertType || "";
  realNameForm.certTypeName = certTypeMap[row.realNameCertType] || "证明材料";
  realNameForm.certImage = row.realNameCertImage || "";
  realNameForm.reviewStatus = "approved";
  realNameForm.rejectReason = "";

  realNameDialog.value = true;
}

// 提交商铺实名认证审核
async function submitRealNameReview() {
  if (realNameForm.reviewStatus === "rejected" && !realNameForm.rejectReason) {
    ElMessage.warning("请输入拒绝原因");
    return;
  }

  reviewing.value = true;

  try {
    await request.post(`/shop-registry/${realNameForm.id}/realname-review`, {
      status: realNameForm.reviewStatus,
      rejectReason: realNameForm.rejectReason,
    });

    reviewing.value = false;
    ElMessage.success("审核成功");
    realNameDialog.value = false;
    loadList();
  } catch (err) {
    reviewing.value = false;
    ElMessage.error("审核失败");
  }
}

onMounted(() => {
  loadList();
});

// 暴露给父页面头部按钮调用（下载导入模板/导入Excel/手动添加）
defineExpose({
  downloadTemplate,
  handleImport,
  importing,
  showAddDialog,
});
</script>

<style scoped>
.shop-registry-tab {
  width: 100%;
}

.search-form {
  margin-bottom: 16px;
}

.import-result {
  padding: 20px;
}

.skip-list,
.error-list {
  margin-top: 20px;
}

/* 实名认证审核对话框样式 */
.realname-review {
  padding: 20px 0;
}

.cert-images {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 20px;
}

.image-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.image-label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.cert-image {
  width: 100%;
  height: 200px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}
</style>
