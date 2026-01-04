<template>
  <div class="staff-list">
    <div class="toolbar">
      <el-button type="primary" @click="handleAdd">添加服务人员</el-button>
    </div>

    <el-table
      :data="staffList"
      border
      stripe
      style="width: 100%; margin-top: 20px"
    >
      <el-table-column label="照片" width="100">
        <template #default="{ row }">
          <el-image
            v-if="row.photo"
            :src="row.photo"
            fit="cover"
            style="width: 60px; height: 60px; border-radius: 4px"
            :preview-src-list="[row.photo]"
          />
          <div v-else class="no-photo">无照片</div>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="姓名" width="120" />
      <el-table-column prop="position" label="职级/岗位" width="150" />
      <el-table-column prop="workScope" label="工作范围" min-width="200" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'">
            {{ row.status === "active" ? "在职" : "停用" }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="handleEdit(row)"
            >编辑</el-button
          >
          <el-button
            :type="row.status === 'active' ? 'warning' : 'success'"
            size="small"
            @click="handleToggleStatus(row)"
          >
            {{ row.status === "active" ? "停用" : "启用" }}
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
      :page-sizes="[10, 20, 50, 100]"
      :total="total"
      layout="total, sizes, prev, pager, next, jumper"
      style="margin-top: 20px; justify-content: center"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      @close="handleDialogClose"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="照片" prop="photo">
          <el-upload
            class="avatar-uploader"
            :action="uploadAction"
            :headers="uploadHeaders"
            :show-file-list="false"
            :on-success="handleUploadSuccess"
            :on-error="handleUploadError"
            :before-upload="beforeUpload"
          >
            <img v-if="formData.photo" :src="formData.photo" class="avatar" />
            <el-icon v-else class="avatar-uploader-icon"><Plus /></el-icon>
          </el-upload>
          <div class="upload-tip">
            建议尺寸：200x200，支持 jpg/png 格式，不超过 2MB
          </div>
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="formData.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="职级/岗位" prop="position">
          <el-input
            v-model="formData.position"
            placeholder="如：保洁员、维修工"
          />
        </el-form-item>
        <el-form-item label="工作范围" prop="workScope">
          <el-input
            v-model="formData.workScope"
            type="textarea"
            :rows="3"
            placeholder="如：A区1-10号楼、公共区域绿化"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import axios from "../../utils/axios";

interface Staff {
  _id?: string;
  name: string;
  position: string;
  workScope: string;
  photo?: string;
  status: "active" | "inactive";
  communityId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const staffList = ref<Staff[]>([]);
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);
const dialogVisible = ref(false);
const dialogTitle = ref("添加服务人员");
const formRef = ref();
const editingId = ref<string | null>(null);

const formData = reactive<Staff>({
  name: "",
  position: "",
  workScope: "",
  photo: "",
  status: "active",
  communityId: "",
});

const formRules = {
  name: [{ required: true, message: "请输入姓名", trigger: "blur" }],
  position: [{ required: true, message: "请输入职级/岗位", trigger: "blur" }],
  workScope: [{ required: true, message: "请输入工作范围", trigger: "blur" }],
};

const uploadAction = ref(
  `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/api/upload`
);
const uploadHeaders = ref({
  Authorization: `Bearer ${localStorage.getItem("admin-token")}`,
});

// 获取服务人员列表
const fetchStaffList = async () => {
  try {
    const user = JSON.parse(localStorage.getItem("admin-user") || "{}");
    const communityId = user.communityId;
    const response = await axios.get("/evaluation/staff", {
      params: {
        communityId,
        page: currentPage.value,
        pageSize: pageSize.value,
      },
    });
    staffList.value = response.data;
    total.value = response.total;
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || "获取服务人员列表失败");
  }
};

// 添加服务人员
const handleAdd = () => {
  dialogTitle.value = "添加服务人员";
  editingId.value = null;
  Object.assign(formData, {
    name: "",
    position: "",
    workScope: "",
    photo: "",
    status: "active",
    communityId: JSON.parse(localStorage.getItem("admin-user") || "{}")
      .communityId,
  });
  dialogVisible.value = true;
};

// 编辑服务人员
const handleEdit = (row: Staff) => {
  dialogTitle.value = "编辑服务人员";
  editingId.value = row._id || null;
  Object.assign(formData, {
    name: row.name,
    position: row.position,
    workScope: row.workScope,
    photo: row.photo,
    status: row.status,
    communityId: row.communityId,
  });
  dialogVisible.value = true;
};

// 切换状态
const handleToggleStatus = async (row: Staff) => {
  const action = row.status === "active" ? "停用" : "启用";
  try {
    await ElMessageBox.confirm(`确定要${action}该服务人员吗？`, "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });

    const response = await axios.put(`/evaluation/staff/${row._id}`, {
      status: row.status === "active" ? "inactive" : "active",
    });

    ElMessage.success(`${action}成功`);
    fetchStaffList();
  } catch (error: any) {
    if (error !== "cancel") {
      ElMessage.error(error.response?.data?.error || `${action}失败`);
    }
  }
};

// 删除服务人员
const handleDelete = async (row: Staff) => {
  try {
    await ElMessageBox.confirm(
      "删除后无法恢复，确定要删除该服务人员吗？",
      "警告",
      {
        confirmButtonText: "确定删除",
        cancelButtonText: "取消",
        type: "error",
      }
    );

    const response = await axios.delete(`/evaluation/staff/${row._id}`);

    ElMessage.success("删除成功");
    fetchStaffList();
  } catch (error: any) {
    if (error !== "cancel") {
      ElMessage.error(error.response?.data?.error || "删除失败");
    }
  }
};

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value.validate();

    const url = editingId.value
      ? `/evaluation/staff/${editingId.value}`
      : "/evaluation/staff";

    const method = editingId.value ? "put" : "post";

    const response = await axios[method](url, formData);

    ElMessage.success(editingId.value ? "编辑成功" : "添加成功");
    dialogVisible.value = false;
    fetchStaffList();
  } catch (error: any) {
    if (error.response) {
      ElMessage.error(error.response.data?.error || "操作失败");
    }
  }
};

// 图片上传前验证
const beforeUpload = (file: File) => {
  const isImage = file.type === "image/jpeg" || file.type === "image/png";
  const isLt2M = file.size / 1024 / 1024 < 2;

  if (!isImage) {
    ElMessage.error("只能上传 JPG/PNG 格式的图片！");
    return false;
  }
  if (!isLt2M) {
    ElMessage.error("图片大小不能超过 2MB！");
    return false;
  }
  return true;
};

// 图片上传成功
const handleUploadSuccess = (response: any) => {
  if (response.success) {
    formData.photo = response.url;
    ElMessage.success("上传成功");
  } else {
    ElMessage.error(response.error || "上传失败");
  }
};

// 图片上传失败
const handleUploadError = () => {
  ElMessage.error("上传失败，请重试");
};

// 关闭对话框
const handleDialogClose = () => {
  formRef.value?.resetFields();
};

// 分页相关
const handleSizeChange = (size: number) => {
  pageSize.value = size;
  currentPage.value = 1;
  fetchStaffList();
};

const handleCurrentChange = (page: number) => {
  currentPage.value = page;
  fetchStaffList();
};

onMounted(() => {
  fetchStaffList();
});
</script>

<style scoped>
.staff-list {
  padding: 20px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.no-photo {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f5f5;
  color: #999;
  border-radius: 4px;
  font-size: 12px;
}

.avatar-uploader {
  display: inline-block;
}

.avatar-uploader :deep(.el-upload) {
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: border-color 0.3s;
}

.avatar-uploader :deep(.el-upload:hover) {
  border-color: #409eff;
}

.avatar-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar {
  width: 120px;
  height: 120px;
  display: block;
  object-fit: cover;
}

.upload-tip {
  font-size: 12px;
  color: #999;
  margin-top: 8px;
}
</style>
