<template>
  <div
    class="owner-registry-page"
    style="height: calc(100vh - 96px); display: flex; flex-direction: column"
  >
    <el-card
      style="flex: 1; display: flex; flex-direction: column; overflow: hidden"
    >
      <template #header>
        <div class="card-header">
          <span>业主名册</span>
          <div class="header-actions">
            <el-button type="success" @click="downloadTemplate"
              >下载导入模板</el-button
            >
            <el-upload
              action="#"
              :show-file-list="false"
              :before-upload="handleImport"
              :disabled="importing"
              accept=".xlsx,.xls"
            >
              <el-button type="primary" :loading="importing">
                {{ importing ? "导入中..." : "导入Excel" }}
              </el-button>
            </el-upload>
            <el-button type="primary" @click="showAddDialog"
              >手动添加</el-button
            >
          </div>
        </div>
      </template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="姓名">
          <el-input
            v-model="searchForm.name"
            placeholder="请输入姓名"
            clearable
          />
        </el-form-item>
        <el-form-item label="楼栋">
          <el-input
            v-model="searchForm.building"
            placeholder="请输入楼栋"
            clearable
          />
        </el-form-item>
        <el-form-item label="单元">
          <el-input
            v-model="searchForm.unit"
            placeholder="请输入单元"
            clearable
          />
        </el-form-item>
        <el-form-item label="房号">
          <el-input
            v-model="searchForm.room"
            placeholder="请输入房号"
            clearable
          />
        </el-form-item>
        <el-form-item label="导入状态">
          <el-select
            v-model="searchForm.status"
            placeholder="全部"
            clearable
            style="width: 120px"
          >
            <el-option label="有效" value="valid" />
            <el-option label="无效" value="invalid" />
          </el-select>
        </el-form-item>
        <el-form-item label="注册认证状态">
          <el-select
            v-model="searchForm.certStatus"
            placeholder="全部"
            clearable
            style="width: 120px"
          >
            <el-option label="未申请" value="none" />
            <el-option label="已通过" value="approved" />
            <el-option label="进行中" value="pending" />
            <el-option label="未通过" value="rejected" />
          </el-select>
        </el-form-item>
        <el-form-item label="实名认证状态">
          <el-select
            v-model="searchForm.realNameStatus"
            placeholder="全部"
            clearable
            style="width: 120px"
          >
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

      <div
        style="flex: 1; display: flex; flex-direction: column; overflow: hidden"
      >
        <div class="batch-operations" style="margin-bottom: 16px">
          <el-button
            type="primary"
            :loading="selectingAll"
            @click="handleSelect50Data"
          >
            选择50条数据
          </el-button>
          <el-button
            type="danger"
            :disabled="selectedIds.length === 0"
            @click="handleBatchDelete"
          >
            删除
          </el-button>
          <span style="margin-left: 12px; color: #909399">
            已选择 {{ selectedRows.length }} 个业主
          </span>
        </div>

        <el-table
          ref="tableRef"
          :data="registryList"
          stripe
          style="width: 100%"
          height="100%"
          row-key="_id"
          :row-class-name="getRowClassName"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="55" />
          <el-table-column v-if="hasMultipleProperties" type="expand">
            <template #default="{ row }">
              <div
                v-if="row.properties && row.properties.length > 0"
                style="padding: 20px 50px"
              >
                <div
                  style="margin-bottom: 10px; font-weight: bold; color: #409eff"
                >
                  其他房产信息:
                </div>
                <el-table :data="row.properties" border size="small">
                  <el-table-column
                    prop="building"
                    label="楼栋号"
                    min-width="100"
                  />
                  <el-table-column prop="unit" label="单元号" min-width="100" />
                  <el-table-column prop="room" label="房号" min-width="100">
                    <template #default="{ row }">
                      {{ formatRoom(row.room) }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    prop="area"
                    label="专有面积(㎡)"
                    min-width="120"
                  />
                  <el-table-column prop="remark" label="备注" min-width="120">
                    <template #default="{ row }">
                      {{ row.remark || "-" }}
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </template>
          </el-table-column>
          <el-table-column
            prop="ownerName1"
            label="户主姓名1"
            min-width="120"
          />
          <el-table-column
            prop="ownerName2"
            label="户主姓名2"
            min-width="120"
          />
          <el-table-column prop="building" label="楼栋号" min-width="80" />
          <el-table-column prop="unit" label="单元号" min-width="80" />
          <el-table-column prop="room" label="房号" min-width="80">
            <template #default="{ row }">
              {{ formatRoom(row.room) }}
            </template>
          </el-table-column>
          <el-table-column label="车牌号" min-width="150">
            <template #default="{ row }">
              <el-tooltip
                v-if="row.carNumber && row.carNumber.length > 15"
                :content="row.carNumber"
                placement="top"
              >
                <span style="cursor: pointer">{{
                  row.carNumber.substring(0, 15) + "..."
                }}</span>
              </el-tooltip>
              <span v-else>{{ row.carNumber || "-" }}</span>
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
          <el-table-column
            prop="registrationStatus"
            label="注册认证状态"
            min-width="120"
          >
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
          <el-table-column
            prop="realNameStatusValue"
            label="实名认证状态"
            min-width="120"
          >
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
              <el-button type="primary" size="small" @click="handleEdit(row)">
                编辑
              </el-button>
              <el-button
                type="warning"
                size="small"
                @click="handleRealNameReview(row)"
              >
                审核认证
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        style="padding: 16px 0; justify-content: center; flex-shrink: 0"
        :pager-count="7"
        @size-change="loadList"
        @current-change="loadList"
      />
    </el-card>

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="editDialog"
      :title="editForm.id ? '编辑业主信息' : '添加业主信息'"
      width="700px"
    >
      <el-form
        ref="formRef"
        :model="editForm"
        label-width="120px"
        :rules="formRules"
      >
        <el-form-item label="户主姓名1" prop="ownerName1">
          <el-input v-model="editForm.ownerName1" placeholder="必填" />
        </el-form-item>
        <el-form-item label="户主姓名2">
          <el-input v-model="editForm.ownerName2" placeholder="选填" />
        </el-form-item>

        <el-divider content-position="left">房产信息</el-divider>
        <div
          v-for="(property, index) in editForm.properties"
          :key="index"
          style="
            border: 1px solid #eee;
            padding: 16px;
            margin-bottom: 12px;
            border-radius: 4px;
            position: relative;
          "
        >
          <div
            style="
              position: absolute;
              top: 8px;
              right: 8px;
              display: flex;
              gap: 8px;
            "
          >
            <el-button
              v-if="editForm.properties.length > 1"
              type="danger"
              size="small"
              text
              @click="removeProperty(index)"
            >
              删除此房产
            </el-button>
          </div>
          <div style="font-weight: bold; margin-bottom: 12px">
            房产 {{ index + 1 }}
          </div>
          <el-row :gutter="12">
            <el-col :span="8">
              <el-form-item
                :label="'楼栋号'"
                :prop="`properties.${index}.building`"
                :rules="[
                  { required: true, message: '请输入楼栋号', trigger: 'blur' },
                ]"
              >
                <el-input
                  v-model="property.building"
                  placeholder="例如：1"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="12">
            <el-col :span="8">
              <el-form-item
                :label="'单元号'"
                :prop="`properties.${index}.unit`"
                :rules="[
                  { required: true, message: '请输入单元号', trigger: 'blur' },
                ]"
              >
                <el-input
                  v-model="property.unit"
                  placeholder="例如：1"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item
                :label="'房号'"
                :prop="`properties.${index}.room`"
                :rules="[
                  { required: true, message: '请输入房号', trigger: 'blur' },
                ]"
              >
                <el-input
                  v-model="property.room"
                  placeholder="例如：0101（四位数）"
                  style="width: 100%"
                  @blur="property.room = formatRoom(property.room)"
                />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item
                :label="'专有面积'"
                :prop="`properties.${index}.area`"
                :rules="[
                  { required: true, message: '请输入面积', trigger: 'blur' },
                ]"
              >
                <el-input
                  v-model="property.area"
                  placeholder="例如：100"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="12">
            <el-col :span="24">
              <el-form-item
                :label="'备注'"
                :prop="`properties.${index}.remark`"
              >
                <el-input
                  v-model="property.remark"
                  placeholder="例如：商户（如无则留空）"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
          </el-row>
        </div>
        <el-button
          type="primary"
          plain
          style="width: 100%; margin-bottom: 16px"
          @click="addProperty"
        >
          + 添加房产
        </el-button>

        <el-divider content-position="left">车牌号</el-divider>
        <div
          v-for="(carNumber, index) in editForm.carNumbers"
          :key="'car-' + index"
          style="margin-bottom: 12px"
        >
          <el-form-item
            :label="'车牌号 ' + (index + 1)"
            :prop="`carNumbers.${index}`"
          >
            <div style="display: flex; gap: 8px; width: 100%">
              <el-input
                v-model="editForm.carNumbers[index]"
                placeholder="例如：粤B12345（如无则留空）"
                style="flex: 1"
              />
              <el-button
                v-if="editForm.carNumbers.length > 1"
                type="danger"
                text
                @click="removeCarNumber(index)"
              >
                删除
              </el-button>
            </div>
          </el-form-item>
        </div>
        <el-button
          type="primary"
          plain
          style="width: 100%; margin-bottom: 16px"
          @click="addCarNumber"
        >
          + 添加车牌号
        </el-button>

        <el-form-item label="导入状态" prop="status">
          <el-radio-group v-model="editForm.status">
            <el-radio label="valid">有效</el-radio>
            <el-radio label="invalid">无效</el-radio>
          </el-radio-group>
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
                <span style="color: #67c23a; font-weight: bold">{{
                  importResult.addCount
                }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="跳过">
                <span style="color: #e6a23c; font-weight: bold">{{
                  importResult.skipCount
                }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="失败">
                <span style="color: #f56c6c; font-weight: bold">{{
                  importResult.failCount
                }}</span>
              </el-descriptions-item>
            </el-descriptions>
            <div
              v-if="importResult.skipped && importResult.skipped.length > 0"
              class="skip-list"
            >
              <el-divider content-position="left"
                >跳过记录（已存在）</el-divider
              >
              <el-table :data="importResult.skipped" max-height="200">
                <el-table-column prop="row" label="行号" width="80" />
                <el-table-column prop="info" label="说明" />
              </el-table>
            </div>
            <div
              v-if="importResult.errors && importResult.errors.length > 0"
              class="error-list"
            >
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

    <!-- 实名认证审核对话框 -->
    <el-dialog v-model="realNameDialog" title="实名认证审核" width="900px">
      <div class="realname-review">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="户主姓名">
            {{ realNameForm.ownerName1 }}
          </el-descriptions-item>
          <el-descriptions-item label="提交时间">
            {{ realNameForm.submitTime }}
          </el-descriptions-item>
          <el-descriptions-item label="房屋信息">
            {{ realNameForm.building }}栋{{ realNameForm.unit }}单元{{
              realNameForm.room
            }}室
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

          <el-form-item
            v-if="realNameForm.reviewStatus === 'rejected'"
            label="拒绝原因"
          >
            <el-input
              v-model="realNameForm.rejectReason"
              type="textarea"
              :rows="3"
              placeholder="请输入拒绝原因"
            />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="realNameDialog = false">取消</el-button>
        <el-button
          type="primary"
          :loading="reviewing"
          @click="submitRealNameReview"
          >提交审核</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, h, computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Loading } from "@element-plus/icons-vue";
import * as XLSX from "xlsx";
import request from "@/utils/axios";
import { formatRoom } from "@/utils/formatRoom";

const registryList = ref<any[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);
const selectedIds = ref<string[]>([]);
const selectedRows = ref<any[]>([]);
const importing = ref(false);
const tableRef = ref();
const allDataSelected = ref(false);
const selectingAll = ref(false);
const isBatchSelecting = ref(false); // 正在批量选择中的标志

// 检查是否有多套房产的数据
const hasMultipleProperties = computed(() => {
  return registryList.value.some(
    (item) => item.properties && item.properties.length > 0,
  );
});

const searchForm = reactive({
  name: "",
  building: "",
  unit: "",
  room: "",
  status: "",
  certStatus: "",
  realNameStatus: "",
});

const editDialog = ref(false);
const editForm = reactive({
  id: "",
  ownerName1: "",
  ownerName2: "",
  properties: [
    {
      building: "",
      unit: "",
      room: "",
      area: "",
    },
  ] as any[],
  carNumbers: [""] as string[],
  status: "valid",
});

const formRules = {
  ownerName1: [{ required: true, message: "请输入户主姓名1", trigger: "blur" }],
  building: [{ required: true, message: "请输入楼栋号", trigger: "blur" }],
  unit: [{ required: true, message: "请输入单元号", trigger: "blur" }],
  room: [{ required: true, message: "请输入房号", trigger: "blur" }],
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
  building: "",
  unit: "",
  room: "",
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

    const data = await request.get("/owner-registry", { params });
    const rawList = data.data || [];

    // 合并同一户主的多套房产
    const ownerMap = new Map();

    rawList.forEach((item: any) => {
      const key = `${item.ownerName1}_${item.ownerName2 || ""}`;

      if (ownerMap.has(key)) {
        // 已存在该户主，将当前房产添加到 properties
        const owner = ownerMap.get(key);
        if (!owner.properties) {
          owner.properties = [];
        }
        owner.properties.push({
          building: item.building,
          unit: item.unit,
          room: item.room,
          area: item.area,
          remark: item.remark,
          _id: item._id,
        });
        // 合并车牌号
        if (item.carNumber && !owner.carNumber.includes(item.carNumber)) {
          owner.carNumber = owner.carNumber
            ? `${owner.carNumber},${item.carNumber}`
            : item.carNumber;
        }
      } else {
        // 新户主记录 - 不初始化 properties 数组
        ownerMap.set(key, {
          ...item,
        });
      }
    });

    registryList.value = Array.from(ownerMap.values());
    total.value = data.total || 0;

    // 如果是全选状态，自动选中当前页的所有行
    if (allDataSelected.value) {
      setTimeout(() => {
        registryList.value.forEach((row) => {
          tableRef.value?.toggleRowSelection(row, true);
        });
      }, 0);
    }
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
  searchForm.building = "";
  searchForm.unit = "";
  searchForm.room = "";
  searchForm.status = "";
  searchForm.certStatus = "";
  searchForm.realNameStatus = "";
  search();
}

function downloadTemplate() {
  // 创建Excel模板
  const template = [
    ["【提示：以下示例说明和示例数据不会被导入，无需删除】"],
    ["示例说明："],
    [
      "1. 一个户主多套房：第一行填完整信息，后续房产只填楼栋号、单元号、房号、专有面积，户主姓名留空",
    ],
    ["2. 一个户主多辆车：在车牌号单元格用逗号分隔，如：粤B12345,粤B67890"],
    [""],
    [
      "户主姓名1（必填）",
      "户主姓名2（如无，留空）",
      "楼栋号（必填）",
      "单元号（必填）",
      "房号（必填）",
      "车牌号（多个用逗号分隔，如无则留空）",
      "专有面积（必填）",
      "备注（如无，留空）",
    ],
    ["张三", "李四", "1", "1", "101", "粤B12345,粤B67890", "100", "商户"],
    ["", "", "1", "2", "201", "", "120", ""],
    ["王五", "", "3", "1", "102", "粤A88888", "95", ""],
  ];

  const ws = XLSX.utils.aoa_to_sheet(template);

  // 设置列宽
  const colWidths = [
    { wch: 20 }, // 户主姓名1
    { wch: 22 }, // 户主姓名2
    { wch: 15 }, // 楼栋号
    { wch: 15 }, // 单元号
    { wch: 15 }, // 房号
    { wch: 30 }, // 车牌号
    { wch: 20 }, // 专有面积
    { wch: 20 }, // 备注
  ];
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "业主名册");
  XLSX.writeFile(wb, "业主名册导入模板.xlsx");
}

async function handleImport(file: File) {
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

      // 跳过前9行（提示1行、说明2行、空行1行、表头1行、示例数据3行）
      const rows = jsonData.slice(9).filter((row) => row.length > 0);

      // 预处理数据：合并同一户主的多套房产
      const processedData: any[] = [];
      let currentOwner: any = null;

      rows.forEach((row, index) => {
        const ownerName1 = row[0]?.toString() || "";
        const rowData = {
          ownerName1,
          ownerName2: row[1]?.toString() || "",
          building: row[2]?.toString() || "",
          unit: row[3]?.toString() || "",
          room: row[4]?.toString() || "",
          carNumber: row[5]?.toString() || "",
          area: row[6]?.toString() || "",
          remark: row[7]?.toString() || "",
          rowNumber: index + 10,
        };

        if (ownerName1) {
          // 有户主姓名，新的主记录
          currentOwner = {
            ...rowData,
            properties: [], // 初始化额外房产数组
          };
          processedData.push(currentOwner);
        } else if (currentOwner) {
          // 户主姓名为空，作为当前户主的额外房产
          currentOwner.properties.push({
            building: rowData.building,
            unit: rowData.unit,
            room: rowData.room,
            area: rowData.area,
            remark: rowData.remark,
            rowNumber: rowData.rowNumber,
          });
        } else {
          // 没有前置户主记录的情况，跳过或报错
        }
      });

      const importData = processedData;
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
            "/owner-registry/import",
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

  reader.readAsArrayBuffer(file);
  return false; // 阻止自动上传
}

function showAddDialog() {
  editForm.id = "";
  editForm.ownerName1 = "";
  editForm.ownerName2 = "";
  editForm.properties = [
    {
      building: "",
      unit: "",
      room: "",
      area: "",
      remark: "",
    },
  ];
  editForm.carNumbers = [""];
  editForm.status = "valid";
  editDialog.value = true;
}

function addProperty() {
  editForm.properties.push({
    building: "",
    unit: "",
    room: "",
    area: "",
    remark: "",
  });
}

function removeProperty(index: number) {
  editForm.properties.splice(index, 1);
}

function addCarNumber() {
  editForm.carNumbers.push("");
}

function removeCarNumber(index: number) {
  editForm.carNumbers.splice(index, 1);
}

function handleEdit(row: any) {
  editForm.id = row._id;
  editForm.ownerName1 = row.ownerName1 || "";
  editForm.ownerName2 = row.ownerName2 || "";

  // 处理多房产
  if (row.properties && row.properties.length > 0) {
    // 有多套房产，第一套使用主记录的数据
    editForm.properties = [
      {
        building: row.building,
        unit: row.unit,
        room: row.room,
        area: row.area || "",
        remark: row.remark || "",
      },
      ...row.properties,
    ];
  } else {
    // 只有一套房产
    editForm.properties = [
      {
        building: row.building,
        unit: row.unit,
        room: row.room,
        area: row.area || "",
        remark: row.remark || "",
      },
    ];
  }

  // 处理多车牌号
  if (row.carNumber) {
    editForm.carNumbers = row.carNumber.split(",").map((c: string) => c.trim());
  } else {
    editForm.carNumbers = [""];
  }

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
      ownerName2: editForm.ownerName2,
      properties: editForm.properties,
      carNumber: editForm.carNumbers
        .filter((c) => c && c.trim())
        .map((c) => c.trim())
        .join(","),
      status: editForm.status,
    };

    if (editForm.id) {
      await request.put(`/owner-registry/${editForm.id}`, submitData);
    } else {
      await request.post("/owner-registry", submitData);
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

// 选择前50条数据
async function handleSelect50Data() {
  if (total.value === 0) {
    ElMessage.warning("没有数据可选择");
    return;
  }

  try {
    await ElMessageBox.confirm("确定要选择前50个业主的数据吗？", "选择数据", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });

    selectingAll.value = true;

    try {
      // 获取足够的房产记录，以确保能得到至少50个业主
      // 假设平均每个业主有2套房，获取100条记录应该足够
      const params: any = {
        page: 1,
        pageSize: 100,
        ...searchForm,
      };

      const data = await request.get("/owner-registry", { params });
      const rawList = data.data || [];

      // 合并同一户主的多套房产
      const ownerMap = new Map();
      rawList.forEach((item: any) => {
        const key = `${item.ownerName1}_${item.ownerName2 || ""}`;
        if (ownerMap.has(key)) {
          const owner = ownerMap.get(key);
          if (!owner.properties) {
            owner.properties = [];
          }
          owner.properties.push({
            building: item.building,
            unit: item.unit,
            room: item.room,
            area: item.area,
            remark: item.remark,
            _id: item._id,
          });
          if (item.carNumber && !owner.carNumber.includes(item.carNumber)) {
            owner.carNumber = owner.carNumber
              ? `${owner.carNumber},${item.carNumber}`
              : item.carNumber;
          }
        } else {
          ownerMap.set(key, { ...item });
        }
      });

      const allOwners = Array.from(ownerMap.values());

      // 只取前50个业主
      const selectedOwners = allOwners.slice(0, 50);

      // 收集这50个业主的所有ID（包括主记录和额外房产）
      const allIds: string[] = [];
      selectedOwners.forEach((row: any) => {
        allIds.push(row._id);
        if (row.properties && row.properties.length > 0) {
          row.properties.forEach((prop: any) => {
            if (prop._id) {
              allIds.push(prop._id);
            }
          });
        }
      });

      // 先设置全选状态标志
      allDataSelected.value = true;
      selectedIds.value = allIds;
      selectedRows.value = selectedOwners;

      // 设置批量选择标志，防止 toggleRowSelection 触发 handleSelectionChange 干扰
      isBatchSelecting.value = true;

      // 设置当前页所有行为选中状态（仅用于UI显示）
      registryList.value.forEach((row) => {
        // 只选中在 selectedOwners 中的行
        const isSelected = selectedOwners.some(
          (owner) => owner._id === row._id,
        );
        tableRef.value?.toggleRowSelection(row, isSelected);
      });

      // 解除批量选择标志
      isBatchSelecting.value = false;
      selectingAll.value = false;
      ElMessage.success(
        `已选择 ${selectedOwners.length} 个业主（共 ${allIds.length} 条房产记录）`,
      );
    } catch (err: any) {
      selectingAll.value = false;
      ElMessage.error("获取数据失败: " + (err.message || ""));
    }
  } catch (err) {
    // 用户取消选择
  }
}

function handleSelectionChange(selection: any[]) {
  // 如果正在批量选择中，忽略此事件
  if (isBatchSelecting.value) {
    return;
  }

  // 如果是批量选择状态，处理用户手动调整选择的情况
  if (allDataSelected.value) {
    // 获取当前页的所有行ID
    const currentPageIds = registryList.value.map((row) => row._id);

    // 获取当前页被选中的行ID
    const currentPageSelectedIds = selection.map((item) => item._id);

    // 找出当前页被取消选择的行ID
    const deselectedIds = currentPageIds.filter(
      (id) => !currentPageSelectedIds.includes(id),
    );

    // 从全局选择中移除被取消的ID
    selectedIds.value = selectedIds.value.filter(
      (id) => !deselectedIds.includes(id),
    );

    // 从全局选择中移除被取消的行
    selectedRows.value = selectedRows.value.filter(
      (row) => !deselectedIds.includes(row._id),
    );

    // 如果没有选中任何数据了，退出批量选择模式
    if (selectedIds.value.length === 0) {
      allDataSelected.value = false;
    }

    return;
  }

  // 正常处理选择变化
  selectedIds.value = selection.map((item) => item._id);
  selectedRows.value = selection;
}

async function handleBatchDelete() {
  if (selectedIds.value.length === 0) {
    ElMessage.warning("请先选择要删除的记录");
    return;
  }

  try {
    // 计算户主数量和总记录数
    const ownerCount = selectedRows.value.length;
    const recordCount = selectedIds.value.length;

    const message = allDataSelected.value
      ? `确定要删除全部 ${ownerCount} 个户主（共 ${recordCount} 条记录）吗？此操作不可恢复！`
      : `确定要删除选中的 ${ownerCount} 个户主（共 ${recordCount} 条记录）吗？此操作不可恢复！`;

    await ElMessageBox.confirm(message, "批量删除确认", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });

    // 收集所有需要删除的ID（包括主记录和额外房产记录）
    const allIdsToDelete: string[] = [];
    selectedRows.value.forEach((row) => {
      // 添加主记录ID
      allIdsToDelete.push(row._id);
      // 如果有额外房产，添加所有额外房产的ID
      if (row.properties && row.properties.length > 0) {
        row.properties.forEach((prop: any) => {
          if (prop._id) {
            allIdsToDelete.push(prop._id);
          }
        });
      }
    });

    const deletePromises = allIdsToDelete.map((id) =>
      request
        .delete(`/owner-registry/${id}`)
        .then(() => ({ success: true }))
        .catch(() => ({ success: false })),
    );

    const results = await Promise.all(deletePromises);
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    if (failCount === 0) {
      ElMessage.success(
        `成功删除 ${selectedIds.value.length} 个户主的所有房产记录`,
      );
    } else {
      ElMessage.warning(
        `删除完成：成功 ${successCount} 条，失败 ${failCount} 条`,
      );
    }

    selectedIds.value = [];
    selectedRows.value = [];
    allDataSelected.value = false;
    loadList();
  } catch (err: any) {
    if (err !== "cancel") {
      ElMessage.error("批量删除失败");
    }
  }
}

async function handleDelete(row: any) {
  try {
    const propertyCount =
      row.properties && row.properties.length > 0
        ? row.properties.length + 1
        : 1;
    const confirmMsg =
      propertyCount > 1
        ? `确定要删除业主 ${row.ownerName1} 的所有 ${propertyCount} 套房产吗？此操作不可恢复！`
        : `确定要删除业主 ${row.ownerName1} (${row.building}栋${row.unit}单元${row.room}室) 吗？`;

    await ElMessageBox.confirm(confirmMsg, "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });

    // 收集所有需要删除的ID
    const idsToDelete = [row._id];
    if (row.properties && row.properties.length > 0) {
      row.properties.forEach((prop: any) => {
        if (prop._id) {
          idsToDelete.push(prop._id);
        }
      });
    }

    // 删除所有记录
    const deletePromises = idsToDelete.map((id) =>
      request
        .delete(`/owner-registry/${id}`)
        .then(() => ({ success: true }))
        .catch(() => ({ success: false })),
    );

    const results = await Promise.all(deletePromises);
    const successCount = results.filter((r) => r.success).length;

    if (successCount === idsToDelete.length) {
      ElMessage.success("删除成功");
      loadList();
    } else {
      ElMessage.error("部分记录删除失败");
      loadList();
    }
  } catch (err: any) {
    if (err !== "cancel") {
      ElMessage.error("删除失败");
    }
  }
}

function refresh() {
  loadList();
}

function getRowClassName({ row }: { row: any }) {
  // 只有一套房产的行添加 no-expand 类名
  return !row.properties || row.properties.length === 0 ? "no-expand" : "";
}

// 处理实名认证审核
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
  realNameForm.building = row.building;
  realNameForm.unit = row.unit;
  realNameForm.room = row.room;
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

// 提交实名认证审核
async function submitRealNameReview() {
  if (realNameForm.reviewStatus === "rejected" && !realNameForm.rejectReason) {
    ElMessage.warning("请输入拒绝原因");
    return;
  }

  reviewing.value = true;

  try {
    await request.post(`/owner-registry/${realNameForm.id}/realname-review`, {
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
</script>

<style scoped>
.owner-registry-page {
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.batch-operations {
  margin-bottom: 16px;
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

/* 隐藏只有一套房产的行的展开图标 */
:deep(.no-expand .el-table__expand-icon) {
  visibility: hidden;
  cursor: default;
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
