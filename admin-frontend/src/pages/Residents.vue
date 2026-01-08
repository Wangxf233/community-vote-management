<template>
  <div class="residents-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>业主审核</span>
          <el-button type="primary" @click="refresh">刷新</el-button>
        </div>
      </template>

      <el-table :data="residentsList" stripe style="width: 100%">
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column prop="realName" label="实名姓名" width="100" />
        <el-table-column prop="name" label="填写姓名" width="100" />
        <el-table-column prop="phone" label="电话号码" width="120" />
        <el-table-column prop="building" label="楼栋" width="80" />
        <el-table-column prop="unit" label="单元" width="80" />
        <el-table-column prop="room" label="房号" width="80">
          <template #default="{ row }">
            {{ formatRoom(row.room) }}
          </template>
        </el-table-column>
        <el-table-column prop="matchStatus" label="匹配状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.matchStatus === 'matched'" type="success"
              >已匹配</el-tag
            >
            <el-tag v-else-if="row.matchStatus === 'not_match'" type="warning"
              >不匹配</el-tag
            >
            <el-tag v-else type="info">未检测</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="审核状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              size="small"
              :disabled="row.status !== 'pending'"
              @click="handleAudit(row)"
            >
              审核
            </el-button>
            <el-button
              size="small"
              @click="handleViewProof(row)"
              v-if="row.proofImages && row.proofImages.length > 0"
            >
              查看证明
            </el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">
              删除
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
        @size-change="loadList"
        @current-change="loadList"
        style="margin-top: 16px; justify-content: center"
        :pager-count="7"
      />
    </el-card>

    <!-- 审核对话框 -->
    <el-dialog v-model="auditDialog" title="业主审核" width="700px">
      <el-form :model="auditForm" label-width="120px">
        <el-form-item label="实名姓名">
          <span>{{ auditForm.realName || "-" }}</span>
          <el-tag
            v-if="auditForm.idCardVerified"
            type="success"
            size="small"
            style="margin-left: 8px"
          >
            已实名认证
          </el-tag>
        </el-form-item>
        <el-form-item label="填写姓名">
          <span>{{ auditForm.name }}</span>
        </el-form-item>
        <el-form-item label="电话">
          <span>{{ auditForm.phone }}</span>
        </el-form-item>
        <el-form-item label="地址">
          <span>{{ auditForm.fullAddress }}</span>
        </el-form-item>
        <el-form-item label="匹配结果">
          <el-alert
            v-if="auditForm.matchStatus === 'matched'"
            title="✓ 该用户信息与业主清册匹配"
            type="success"
            :closable="false"
          />
          <el-alert
            v-else-if="auditForm.matchStatus === 'not_match'"
            title="✗ 该用户信息与业主清册不匹配，请核实"
            type="warning"
            :closable="false"
          />
          <el-alert
            v-else
            title="业主清册中无此房号记录"
            type="info"
            :closable="false"
          />
        </el-form-item>
        <el-form-item
          label="房产证明"
          v-if="auditForm.proofImages && auditForm.proofImages.length > 0"
        >
          <div class="proof-images">
            <el-image
              v-for="(img, idx) in auditForm.proofImages"
              :key="idx"
              :src="img"
              :preview-src-list="auditForm.proofImages"
              :initial-index="idx"
              fit="cover"
              style="
                width: 100px;
                height: 100px;
                margin-right: 8px;
                cursor: pointer;
              "
            />
          </div>
        </el-form-item>

        <el-divider />

        <el-form-item label="审核结果">
          <el-radio-group v-model="auditForm.result">
            <el-radio label="approved">通过</el-radio>
            <el-radio label="rejected">拒绝</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="auditForm.result === 'rejected'" label="拒绝原因">
          <el-select
            v-model="auditForm.rejectReason"
            placeholder="请选择拒绝原因"
            style="width: 100%"
          >
            <el-option
              label="姓名与房号信息不匹配"
              value="姓名与房号信息不匹配"
            />
            <el-option
              label="个人信息与上传的房产证、购房合同、全款发票、交房证明信息不匹配"
              value="个人信息与上传的房产证、购房合同、全款发票、交房证明信息不匹配"
            />
            <el-option
              label="上传的证明材料不清晰或不完整"
              value="上传的证明材料不清晰或不完整"
            />
            <el-option label="未上传房产证明材料" value="未上传房产证明材料" />
            <el-option label="自定义" value="custom" />
          </el-select>
        </el-form-item>
        <el-form-item
          v-if="
            auditForm.result === 'rejected' &&
            auditForm.rejectReason === 'custom'
          "
          label="自定义原因"
        >
          <el-input
            v-model="auditForm.customReason"
            type="textarea"
            :rows="3"
            placeholder="请输入具体拒绝原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="auditDialog = false">取消</el-button>
        <el-button type="primary" @click="submitAudit">提交</el-button>
      </template>
    </el-dialog>

    <!-- 证明材料查看对话框 -->
    <el-dialog v-model="proofDialog" title="查看证明材料" width="800px">
      <div class="proof-viewer">
        <el-image
          v-for="(img, idx) in proofImages"
          :key="idx"
          :src="img"
          :preview-src-list="proofImages"
          :initial-index="idx"
          fit="contain"
          style="width: 100%; margin-bottom: 16px"
        />
      </div>
      <template #footer>
        <el-button @click="proofDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 修改对话框 -->
    <el-dialog v-model="editDialog" title="修改业主信息" width="600px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="姓名">
          <el-input v-model="editForm.name" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="editForm.phone" />
        </el-form-item>
        <el-form-item label="楼栋">
          <el-input v-model="editForm.building" />
        </el-form-item>
        <el-form-item label="单元">
          <el-input v-model="editForm.block" />
        </el-form-item>
        <el-form-item label="房间">
          <el-input v-model="editForm.room" />
        </el-form-item>
        <el-form-item label="住宅面积">
          <el-input v-model.number="editForm.residentialArea" />
        </el-form-item>
        <el-form-item label="商业面积">
          <el-input v-model.number="editForm.commercialArea" />
        </el-form-item>
        <el-form-item label="车位面积">
          <el-input v-model.number="editForm.parkingArea" />
        </el-form-item>
        <el-form-item label="车牌号">
          <el-input v-model="editForm.carNumber" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialog = false">取消</el-button>
        <el-button type="primary" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import request from "@/utils/axios";
import { formatRoom } from "@/utils/formatRoom";

const residentsList = ref<any[]>([]);
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);

const auditDialog = ref(false);
const auditForm = reactive({
  id: "",
  userType: "owner",
  realName: "",
  idCardVerified: false,
  name: "",
  phone: "",
  fullAddress: "",
  matchStatus: "",
  proofImages: [] as string[],
  result: "approved",
  rejectReason: "",
  customReason: "",
});

const proofDialog = ref(false);
const proofImages = ref<string[]>([]);

const editDialog = ref(false);
const editForm = reactive({
  id: "",
  name: "",
  phone: "",
  building: "",
  unit: "",
  room: "",
  residentialArea: 0,
  commercialArea: 0,
  parkingArea: 0,
  carNumber: "",
});

function getStatusText(status: string) {
  const map: Record<string, string> = {
    none: "未提交",
    pending: "审核中",
    approved: "已通过",
    rejected: "已拒绝",
  };
  return map[status] || status;
}

function getStatusType(status: string) {
  const map: Record<string, any> = {
    none: "info",
    pending: "warning",
    approved: "success",
    rejected: "danger",
  };
  return map[status] || "info";
}

function calculateTotalArea(row: any) {
  const residential = parseFloat(row.residentialArea) || 0;
  const commercial = parseFloat(row.commercialArea) || 0;
  const parking = parseFloat(row.parkingArea) || 0;
  return (residential + commercial + parking).toFixed(2);
}

async function loadList() {
  try {
    const data = await request.get("/residents", {
      params: {
        page: currentPage.value,
        pageSize: pageSize.value,
      },
    });

    residentsList.value = data.data || [];
    total.value = data.total || 0;
  } catch (err) {
    console.error("加载业主列表失败:", err);
    ElMessage.error("加载失败");
  }
}

function handleAudit(row: any) {
  auditForm.id = row._id;
  auditForm.userType = row.userType || "owner";
  auditForm.realName = row.realName || "";
  auditForm.idCardVerified = row.idCardVerified || false;
  auditForm.name = row.name || "-";
  auditForm.phone = row.phone || "-";
  auditForm.fullAddress = `${row.building}栋${row.unit}单元${row.room}室`;
  auditForm.matchStatus = row.matchStatus || "";
  auditForm.proofImages = row.proofImages || [];
  auditForm.result = "approved";
  auditForm.rejectReason = "";
  auditForm.customReason = "";
  auditDialog.value = true;
}

function handleViewProof(row: any) {
  proofImages.value = row.proofImages || [];
  proofDialog.value = true;
}

async function submitAudit() {
  if (auditForm.result === "rejected") {
    if (!auditForm.rejectReason) {
      ElMessage.warning("请选择拒绝原因");
      return;
    }
    if (auditForm.rejectReason === "custom" && !auditForm.customReason) {
      ElMessage.warning("请输入自定义拒绝原因");
      return;
    }
  }

  try {
    const finalReason =
      auditForm.rejectReason === "custom"
        ? auditForm.customReason
        : auditForm.rejectReason;

    await request.post(`/residents/${auditForm.id}/audit`, {
      status: auditForm.result,
      rejectReason: finalReason,
    });

    ElMessage.success("审核成功");
    auditDialog.value = false;
    loadList();
  } catch (err) {
    console.error("审核失败:", err);
    ElMessage.error("审核失败");
  }
}

function handleEdit(row: any) {
  editForm.id = row._id;
  editForm.name = row.name || "";
  editForm.phone = row.phone || "";
  editForm.building = row.building || "";
  editForm.unit = row.unit || "";
  editForm.room = row.room || "";
  editForm.residentialArea = row.residentialArea || 0;
  editForm.commercialArea = row.commercialArea || 0;
  editForm.parkingArea = row.parkingArea || 0;
  editForm.carNumber = row.carNumber || "";
  editDialog.value = true;
}

async function submitEdit() {
  try {
    await request.put(`/residents/${editForm.id}`, editForm);

    ElMessage.success("修改成功");
    editDialog.value = false;
    loadList();
  } catch (err) {
    console.error("修改失败:", err);
    ElMessage.error("修改失败");
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm("确定要删除该业主信息吗？", "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });

    await request.delete(`/residents/${row._id}`);

    ElMessage.success("删除成功");
    loadList();
  } catch (err: any) {
    if (err !== "cancel") {
      console.error("删除失败:", err);
      ElMessage.error("删除失败");
    }
  }
}

function refresh() {
  loadList();
}

onMounted(() => {
  loadList();
});
</script>

<style scoped>
.residents-page {
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
