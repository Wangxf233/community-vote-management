<template>
  <div class="cycles-list">
    <div class="toolbar">
      <el-button type="primary" @click="handleAdd">发布评价</el-button>
    </div>

    <el-table
      :data="cyclesList"
      border
      stripe
      style="width: 100%; margin-top: 20px"
    >
      <el-table-column prop="title" label="评价标题" min-width="200" />
      <el-table-column label="评价周期" width="220">
        <template #default="{ row }">
          {{ formatDate(row.startDate) }} 至 {{ formatDate(row.endDate) }}
        </template>
      </el-table-column>
      <el-table-column label="开始提交时间" width="160">
        <template #default="{ row }">
          {{
            row.startSubmitTime
              ? formatDateTime(row.startSubmitTime)
              : "立即发布"
          }}
        </template>
      </el-table-column>
      <el-table-column label="截止提交时间" width="160">
        <template #default="{ row }">
          {{ formatDateTime(row.deadline) }}
        </template>
      </el-table-column>
      <el-table-column label="发布状态" width="100">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">
            {{ getStatusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="参与人数" width="100">
        <template #default="{ row }">
          {{ row.participantCount || 0 }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="handleEdit(row)"
            >编辑</el-button
          >
          <el-button type="success" size="small" @click="handleViewResults(row)"
            >查看结果</el-button
          >
          <el-button type="danger" size="small" @click="handleDelete(row)"
            >删除</el-button
          >
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :page-sizes="[10, 20, 50, 100]"
      :total="total"
      layout="total, sizes, prev, pager, next, jumper"
      style="margin-top: 20px; justify-content: center"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />

    <!-- 发布/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="800px"
      @close="handleDialogClose"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="120px"
      >
        <el-form-item label="评价标题" prop="title">
          <el-input
            v-model="formData.title"
            placeholder="如：2024年第一季度物业服务满意度评价"
          />
        </el-form-item>
        <el-form-item label="评价周期" prop="dateRange">
          <el-date-picker
            v-model="formData.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item label="开始提交时间" prop="startSubmitTime">
          <el-radio-group v-model="startSubmitType" style="margin-bottom: 10px">
            <el-radio :label="'now'">立即发布</el-radio>
            <el-radio :label="'custom'">自定义时间</el-radio>
          </el-radio-group>
          <el-date-picker
            v-if="startSubmitType === 'custom'"
            v-model="formData.startSubmitTime"
            type="datetime"
            placeholder="选择开始日期时间"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DD HH:mm"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="截止提交时间" prop="deadline">
          <el-date-picker
            v-model="formData.deadline"
            type="datetime"
            placeholder="选择截止日期时间"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DD HH:mm"
          />
        </el-form-item>
        <el-form-item label="选择被评人员" prop="staffIds">
          <el-button @click="showStaffSelector"
            >选择人员 (已选 {{ formData.staffIds.length }} 人)</el-button
          >
        </el-form-item>
        <el-form-item label="评价维度" prop="dimensions">
          <div class="dimensions-list">
            <div
              v-for="(dim, index) in formData.dimensions"
              :key="index"
              class="dimension-item"
            >
              <el-input
                v-model="dim.name"
                placeholder="维度名称"
                style="width: 300px; margin-right: 10px"
              />
              <span style="color: #909399; margin-right: 10px">满分10分</span>
              <el-button
                type="danger"
                size="small"
                @click="removeDimension(index)"
                >删除</el-button
              >
            </div>
            <el-button type="primary" size="small" @click="addDimension"
              >添加维度</el-button
            >
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 人员选择器对话框 -->
    <el-dialog
      v-model="staffSelectorVisible"
      title="选择服务人员"
      width="800px"
    >
      <el-table
        ref="staffTableRef"
        :data="availableStaff"
        @selection-change="handleStaffSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column label="照片" width="80">
          <template #default="{ row }">
            <el-image
              v-if="row.photo"
              :src="row.photo"
              fit="cover"
              style="width: 40px; height: 40px; border-radius: 4px"
            />
          </template>
        </el-table-column>
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="position" label="职级/岗位" />
      </el-table>
      <template #footer>
        <el-button @click="staffSelectorVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmStaffSelection"
          >确定</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import axios from "../../utils/axios";

const router = useRouter();

interface Dimension {
  name: string;
  weight: number;
}

interface Cycle {
  _id?: string;
  title: string;
  startDate: string;
  endDate: string;
  startSubmitTime?: string;
  deadline: string;
  staffIds: string[];
  dimensions: Dimension[];
  status: "draft" | "ongoing" | "closed";
  communityId: string;
  participantCount?: number;
  totalUsers?: number;
}

const cyclesList = ref<Cycle[]>([]);
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);
const dialogVisible = ref(false);
const dialogTitle = ref("发布评价");
const formRef = ref();
const editingId = ref<string | null>(null);
const staffSelectorVisible = ref(false);
const availableStaff = ref<any[]>([]);
const selectedStaff = ref<any[]>([]);
const staffTableRef = ref();
const startSubmitType = ref<"now" | "custom">("now");

const formData = reactive<any>({
  title: "",
  dateRange: [],
  startSubmitTime: "",
  deadline: "",
  staffIds: [],
  dimensions: [
    { name: "服务态度", weight: 10 },
    { name: "响应速度", weight: 10 },
    { name: "专业技能", weight: 10 },
  ],
  communityId: "",
});

const formRules = {
  title: [{ required: true, message: "请输入评价标题", trigger: "blur" }],
  dateRange: [{ required: true, message: "请选择评价周期", trigger: "change" }],
  deadline: [
    { required: true, message: "请选择截止提交时间", trigger: "change" },
  ],
  staffIds: [{ required: true, message: "请选择被评人员", trigger: "change" }],
};

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
    "0",
  )}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(
    2,
    "0",
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
        page: currentPage.value,
        pageSize: pageSize.value,
      },
    });
    cyclesList.value = response.data;
    total.value = response.total;
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || "获取评价周期列表失败");
  }
};

// 获取可用的服务人员
const fetchAvailableStaff = async () => {
  try {
    const user = JSON.parse(localStorage.getItem("admin-user") || "{}");
    const communityId = user.communityId;
    const response = await axios.get("/evaluation/staff", {
      params: {
        communityId,
        status: "active",
        pageSize: 1000,
      },
    });
    availableStaff.value = response.data;
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || "获取服务人员列表失败");
  }
};

// 添加评价
const handleAdd = async () => {
  await fetchAvailableStaff();
  dialogTitle.value = "发布评价";
  editingId.value = null;
  startSubmitType.value = "now";
  Object.assign(formData, {
    title: "",
    dateRange: [],
    startSubmitTime: "",
    deadline: "",
    staffIds: [],
    dimensions: [
      { name: "服务态度", weight: 5 },
      { name: "响应速度", weight: 5 },
      { name: "专业技能", weight: 5 },
    ],
    communityId: JSON.parse(localStorage.getItem("admin-user") || "{}")
      .communityId,
  });
  dialogVisible.value = true;
};

// 编辑评价
const handleEdit = async (row: Cycle) => {
  await fetchAvailableStaff();
  dialogTitle.value = "编辑评价";
  editingId.value = row._id || null;
  startSubmitType.value = row.startSubmitTime ? "custom" : "now";
  Object.assign(formData, {
    title: row.title,
    dateRange: [row.startDate, row.endDate],
    startSubmitTime: row.startSubmitTime || "",
    deadline: row.deadline,
    staffIds: [...row.staffIds],
    dimensions: [...row.dimensions],
    communityId: row.communityId,
  });
  dialogVisible.value = true;
};

// 删除评价
const handleDelete = async (row: Cycle) => {
  try {
    await ElMessageBox.confirm("确定要删除该评价吗？", "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });

    const response = await axios.delete(`/evaluation/cycles/${row._id}`);

    ElMessage.success("删除成功");
    fetchCyclesList();
  } catch (error: any) {
    if (error !== "cancel") {
      ElMessage.error(error.response?.data?.error || "删除失败");
    }
  }
};

// 查看结果
const handleViewResults = (row: Cycle) => {
  // 使用 sessionStorage 传递周期ID
  sessionStorage.setItem(
    "evaluationsManagement_selectedCycleId",
    row._id || "",
  );
  // 设置目标标签页
  sessionStorage.setItem("evaluationsManagement_targetTab", "results");
  // 刷新页面以触发组件重新加载
  window.location.reload();
};

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value.validate();

    const submitData = {
      ...formData,
      startDate: formData.dateRange[0],
      endDate: formData.dateRange[1],
      startSubmitTime:
        startSubmitType.value === "now" ? undefined : formData.startSubmitTime,
    };
    delete submitData.dateRange;

    const url = editingId.value
      ? `/evaluation/cycles/${editingId.value}`
      : "/evaluation/cycles";

    const method = editingId.value ? "put" : "post";

    const response = await axios[method](url, submitData);

    ElMessage.success(editingId.value ? "编辑成功" : "创建成功");
    dialogVisible.value = false;
    fetchCyclesList();
  } catch (error: any) {
    if (error.response) {
      ElMessage.error(error.response.data?.error || "操作失败");
    }
  }
};

// 显示人员选择器
const showStaffSelector = async () => {
  if (availableStaff.value.length === 0) {
    await fetchAvailableStaff();
  }
  staffSelectorVisible.value = true;

  // 设置已选中的人员
  nextTick(() => {
    availableStaff.value.forEach((staff) => {
      if (formData.staffIds.includes(staff._id)) {
        staffTableRef.value?.toggleRowSelection(staff, true);
      }
    });
  });
};

// 人员选择变化
const handleStaffSelectionChange = (selection: any[]) => {
  selectedStaff.value = selection;
};

// 确认人员选择
const confirmStaffSelection = () => {
  formData.staffIds = selectedStaff.value.map((staff) => staff._id);
  staffSelectorVisible.value = false;
};

// 添加维度
const addDimension = () => {
  formData.dimensions.push({ name: "", weight: 10 });
};

// 删除维度
const removeDimension = (index: number) => {
  formData.dimensions.splice(index, 1);
};

// 关闭对话框
const handleDialogClose = () => {
  formRef.value?.resetFields();
};

// 分页相关
const handleSizeChange = (size: number) => {
  pageSize.value = size;
  currentPage.value = 1;
  fetchCyclesList();
};

const handleCurrentChange = (page: number) => {
  currentPage.value = page;
  fetchCyclesList();
};

onMounted(() => {
  fetchCyclesList();
});
</script>

<style scoped>
.cycles-list {
  padding: 20px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dimensions-list {
  width: 100%;
}

.dimension-item {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}
</style>
