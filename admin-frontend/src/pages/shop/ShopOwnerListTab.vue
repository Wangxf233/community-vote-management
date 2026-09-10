<template>
  <div class="shop-owner-list-tab">
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
      <el-form-item label="实名状态">
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

    <!-- 列表区 -->
    <div class="batch-operations" style="margin-bottom: 16px">
      <el-button type="danger" :disabled="selectedRows.length === 0" @click="handleBatchDelete"> 删除 </el-button>
      <span style="margin-left: 12px; color: #909399"> 已选择 {{ selectedRows.length }} 条 </span>
    </div>

    <el-table :data="ownerList" stripe style="width: 100%" row-key="_id" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" />
      <el-table-column prop="name" label="户主姓名" min-width="100" />
      <el-table-column prop="phone" label="手机号" min-width="120">
        <template #default="{ row }">
          {{ maskPhone(row.phone) }}
        </template>
      </el-table-column>
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
      <el-table-column prop="remark" label="备注" min-width="150">
        <template #default="{ row }">
          <el-tooltip v-if="row.remark && row.remark.length > 10" :content="row.remark" placement="top">
            <span style="cursor: pointer">{{ row.remark.substring(0, 10) + "..." }}</span>
          </el-tooltip>
          <span v-else>{{ row.remark || "-" }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="realNameStatus" label="实名状态" min-width="140">
        <template #default="{ row }">
          <el-tag
            :type="
              row.realNameStatus === 'verified' ? 'success' : row.realNameStatus === 'pending' ? 'warning' : 'info'
            "
          >
            {{ row.realNameStatus === "verified" ? "已实名" : row.realNameStatus === "pending" ? "进行中" : "未实名" }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.realNameStatus === 'pending'"
            type="warning"
            size="small"
            @click="handleReviewRealName(row)"
          >
            审核认证
          </el-button>
          <el-button
            v-else
            :type="
              row.realNameStatus === 'verified' ? 'success' : row.realNameStatus === 'rejected' ? 'danger' : 'info'
            "
            size="small"
            @click="handleViewRealName(row)"
          >
            查看认证
          </el-button>
          <el-button type="primary" size="small" @click="handleEdit(row)"> 编辑 </el-button>
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

    <!-- 编辑对话框 -->
    <el-dialog v-model="editDialog" title="修改商铺户主信息" width="600px">
      <el-form ref="formRef" :model="editForm" label-width="100px" :rules="formRules">
        <el-form-item label="户主姓名" prop="name">
          <el-input v-model="editForm.name" placeholder="必填" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="editForm.phone" placeholder="必填" />
        </el-form-item>
        <el-form-item label="门牌号" prop="houseNumber">
          <el-input v-model="editForm.houseNumber" placeholder="选填" />
        </el-form-item>
        <el-form-item label="商铺名" prop="shopName">
          <el-input v-model="editForm.shopName" placeholder="选填" />
        </el-form-item>
        <el-form-item label="专有面积" prop="area">
          <el-input v-model="editForm.area" placeholder="选填，例如：50" />
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

    <!-- 商铺实名认证审核/查看对话框 -->
    <el-dialog v-model="verifyDialog" :title="isViewMode ? '查看实名认证' : '审核实名认证'" width="900px">
      <div v-if="!verifyForm.hasData" style="text-align: center; padding: 40px">
        <el-empty description="该户主尚未提交实名认证资料" />
      </div>

      <div v-else class="realname-review">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="户主姓名">
            {{ currentRow?.name }}
          </el-descriptions-item>
          <el-descriptions-item label="提交时间">
            {{ verifyForm.submitTime }}
          </el-descriptions-item>
          <el-descriptions-item label="商铺信息">
            {{ currentRow?.houseNumber || "-" }} / {{ currentRow?.shopName || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="证明类型">
            {{ verifyForm.certTypeName }}
          </el-descriptions-item>
          <el-descriptions-item label="认证状态" :span="2">
            <el-tag
              :type="
                verifyForm.status === 'verified'
                  ? 'success'
                  : verifyForm.status === 'pending'
                    ? 'warning'
                    : verifyForm.status === 'rejected'
                      ? 'danger'
                      : 'info'
              "
            >
              {{
                verifyForm.status === "verified"
                  ? "已通过"
                  : verifyForm.status === "pending"
                    ? "审核中"
                    : verifyForm.status === "rejected"
                      ? "已拒绝"
                      : "未认证"
              }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="verifyForm.rejectReason" label="拒绝原因" :span="2">
            <span style="color: #f56c6c">{{ verifyForm.rejectReason }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">认证资料</el-divider>

        <div class="cert-images">
          <div class="image-group">
            <div class="image-label">身份证人像面</div>
            <el-image
              v-if="verifyForm.idCardFront"
              :src="verifyForm.idCardFront"
              fit="contain"
              :preview-src-list="[verifyForm.idCardFront]"
              class="cert-image"
            />
            <el-empty v-else description="未上传" :image-size="100" />
          </div>

          <div class="image-group">
            <div class="image-label">身份证国徽面</div>
            <el-image
              v-if="verifyForm.idCardBack"
              :src="verifyForm.idCardBack"
              fit="contain"
              :preview-src-list="[verifyForm.idCardBack]"
              class="cert-image"
            />
            <el-empty v-else description="未上传" :image-size="100" />
          </div>

          <div class="image-group">
            <div class="image-label">{{ verifyForm.certTypeName }}</div>
            <el-image
              v-if="verifyForm.certImage"
              :src="verifyForm.certImage"
              fit="contain"
              :preview-src-list="[verifyForm.certImage]"
              class="cert-image"
            />
            <el-empty v-else description="未上传" :image-size="100" />
          </div>
        </div>

        <template v-if="!isViewMode && verifyForm.hasData">
          <el-divider content-position="left">审核结果</el-divider>

          <el-form label-width="100px">
            <el-form-item label="审核状态">
              <el-radio-group v-model="verifyForm.reviewStatus">
                <el-radio label="approved">通过</el-radio>
                <el-radio label="rejected">不通过</el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item v-if="verifyForm.reviewStatus === 'rejected'" label="不通过原因">
              <el-select
                v-model="verifyForm.reviewRejectReason"
                placeholder="请选择不通过原因"
                style="width: 100%; margin-bottom: 10px"
                clearable
              >
                <el-option label="材料不齐全或有误" value="材料不齐全或有误" />
                <el-option label="身份证照片不清晰" value="身份证照片不清晰" />
                <el-option label="房产证明无效" value="房产证明无效" />
                <el-option label="信息不匹配" value="信息不匹配" />
                <el-option label="其他原因" value="custom" />
              </el-select>
              <el-input
                v-if="verifyForm.reviewRejectReason === 'custom'"
                v-model="verifyForm.customRejectReason"
                type="textarea"
                :rows="3"
                placeholder="请输入自定义原因"
                style="margin-top: 10px"
              />
            </el-form-item>
          </el-form>
        </template>
      </div>

      <template #footer>
        <el-button @click="verifyDialog = false">{{ isViewMode ? "关闭" : "取消" }}</el-button>
        <el-button v-if="!isViewMode && verifyForm.hasData" type="primary" :loading="reviewing" @click="submitReview">
          提交审核
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import request from "@/utils/axios";

const ownerList = ref<any[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);
const selectedRows = ref<any[]>([]);

const searchForm = reactive({
  name: "",
  houseNumber: "",
  shopName: "",
  realNameStatus: "",
});

const editDialog = ref(false);
const editForm = reactive({
  id: "",
  name: "",
  phone: "",
  houseNumber: "",
  shopName: "",
  area: "",
  remark: "",
});

const formRules = {
  name: [{ required: true, message: "请输入户主姓名", trigger: "blur" }],
  phone: [{ required: true, message: "请输入手机号", trigger: "blur" }],
};

const formRef = ref();

const verifyDialog = ref(false);
const isViewMode = ref(false);
const reviewing = ref(false);
const currentRow = ref<any>(null);
const verifyForm = reactive({
  hasData: false,
  status: "",
  submitTime: "",
  idCardFront: "",
  idCardBack: "",
  certType: "",
  certTypeName: "",
  certImage: "",
  rejectReason: "",
  reviewStatus: "approved",
  reviewRejectReason: "",
  customRejectReason: "",
});

async function loadList() {
  try {
    const params: any = {
      page: currentPage.value,
      pageSize: pageSize.value,
      ...searchForm,
    };

    const data = await request.get("/shop-owner-list", { params });
    ownerList.value = data.data || [];
    total.value = data.total || 0;
  } catch (err) {
    console.error("加载商铺户主名单失败:", err);
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
  searchForm.realNameStatus = "";
  search();
}

function handleEdit(row: any) {
  editForm.id = row._id;
  editForm.name = row.name;
  editForm.phone = row.phone;
  editForm.houseNumber = row.houseNumber || "";
  editForm.shopName = row.shopName || "";
  editForm.area = row.area ?? "";
  editForm.remark = row.remark || "";
  editDialog.value = true;
}

async function submitEdit() {
  try {
    await formRef.value.validate();

    const submitData = {
      id: editForm.id,
      name: editForm.name,
      phone: editForm.phone,
      houseNumber: editForm.houseNumber,
      shopName: editForm.shopName,
      area: editForm.area,
      remark: editForm.remark,
    };

    await request.put(`/shop-owner-list/${editForm.id}`, submitData);
    ElMessage.success("修改成功");
    editDialog.value = false;
    loadList();
  } catch (err) {
    console.error("修改失败:", err);
    // 验证失败或请求失败
  }
}

function handleSelectionChange(selection: any[]) {
  selectedRows.value = selection;
}

// 手机号脱敏：前3后4，中间4位掩码（138****1234）
function maskPhone(phone: string): string {
  if (!phone || phone.length !== 11) return phone || "-";
  return phone.slice(0, 3) + "****" + phone.slice(7);
}

async function handleBatchDelete() {
  if (selectedRows.value.length === 0) {
    ElMessage.warning("请选择要删除的商铺户主");
    return;
  }

  try {
    await ElMessageBox.confirm(`确定要批量删除选中的 ${selectedRows.value.length} 位商铺户主吗？`, "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });

    let successCount = 0;
    let failCount = 0;

    for (const row of selectedRows.value) {
      try {
        await request.delete(`/shop-owner-list/${row._id}`);
        successCount++;
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      ElMessage.success(`成功删除 ${successCount} 位商铺户主`);
    }
    if (failCount > 0) {
      ElMessage.warning(`${failCount} 位商铺户主删除失败`);
    }

    loadList();
  } catch (err: any) {
    if (err !== "cancel") {
      console.error("批量删除失败:", err);
    }
  }
}

async function handleReviewRealName(row: any) {
  currentRow.value = row;
  isViewMode.value = false;
  await loadRealNameData(row._id);
  verifyDialog.value = true;
}

async function handleViewRealName(row: any) {
  currentRow.value = row;

  // 先加载认证数据
  await loadRealNameData(row._id);

  // 如果没有认证数据，显示提示
  if (!verifyForm.hasData) {
    ElMessage.info("该户主还未提交实名认证资料");
    return;
  }

  // 如果状态是已通过或已拒绝，进入查看模式；否则进入审核模式
  isViewMode.value = verifyForm.status === "verified" || verifyForm.status === "rejected";

  verifyDialog.value = true;
}

async function loadRealNameData(ownerId: string) {
  try {
    const data = await request.get(`/shop-owner-list/${ownerId}/realname`);

    if (data.data && data.data.realNameStatus && data.data.realNameStatus !== "unverified") {
      const certTypeMap: any = {
        property: "房产证",
        contract: "购房合同",
        payment: "缴费证明",
      };

      verifyForm.hasData = true;
      verifyForm.status = data.data.realNameStatus;
      verifyForm.submitTime = data.data.realNameSubmitTime || "";
      verifyForm.idCardFront = data.data.realNameIdCardFront || "";
      verifyForm.idCardBack = data.data.realNameIdCardBack || "";
      verifyForm.certType = data.data.realNameCertType || "";
      verifyForm.certTypeName = certTypeMap[data.data.realNameCertType] || "房产证明";
      verifyForm.certImage = data.data.realNameCertImage || "";
      verifyForm.rejectReason = data.data.realNameRejectReason || "";
      verifyForm.reviewStatus = "approved";
      verifyForm.reviewRejectReason = "";
      verifyForm.customRejectReason = "";
    } else {
      verifyForm.hasData = false;
    }
  } catch (err) {
    console.error("加载认证信息失败:", err);
    ElMessage.error("加载失败");
    verifyForm.hasData = false;
  }
}

async function submitReview() {
  try {
    if (verifyForm.reviewStatus === "rejected") {
      if (!verifyForm.reviewRejectReason) {
        ElMessage.warning("请选择不通过原因");
        return;
      }
      if (verifyForm.reviewRejectReason === "custom" && !verifyForm.customRejectReason) {
        ElMessage.warning("请输入自定义原因");
        return;
      }
    }

    reviewing.value = true;

    // 如果选择了自定义原因,使用自定义内容;否则使用选择的原因
    const finalRejectReason =
      verifyForm.reviewRejectReason === "custom" ? verifyForm.customRejectReason : verifyForm.reviewRejectReason;

    await request.post(`/shop-owner-list/${currentRow.value._id}/realname-review`, {
      status: verifyForm.reviewStatus,
      rejectReason: finalRejectReason,
    });

    ElMessage.success("审核提交成功");
    verifyDialog.value = false;
    loadList();
  } catch (err) {
    console.error("提交审核失败:", err);
    ElMessage.error("提交失败");
  } finally {
    reviewing.value = false;
  }
}

onMounted(() => {
  loadList();
});
</script>

<style scoped>
.shop-owner-list-tab {
  width: 100%;
}

.search-form {
  margin-bottom: 16px;
}

.realname-review {
  padding: 0 20px;
}

.cert-images {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin: 20px 0;
}

.image-group {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.image-label {
  font-size: 14px;
  color: #606266;
  margin-bottom: 10px;
  font-weight: 500;
}

.cert-image {
  width: 100%;
  height: 200px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
}

.cert-image :deep(.el-image__inner) {
  object-fit: contain;
}
</style>
