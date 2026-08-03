<template>
  <div class="form-container">
    <div class="form-header">
      <el-button @click="handleBack">← 返回</el-button>
      <h2>{{ isEdit ? "编辑通知" : "添加新通知" }}</h2>
    </div>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="120px"
      style="max-width: 800px; margin: 20px auto"
    >
      <el-form-item label="标题" prop="title">
        <el-input v-model="form.title" placeholder="请输入标题" />
      </el-form-item>

      <el-form-item label="发布人" prop="publisher">
        <el-radio-group v-model="form.publisher">
          <el-radio label="业委会">业委会</el-radio>
          <el-radio label="物业公司">物业公司</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="发布时间" prop="publishTime">
        <el-radio-group
          v-model="publishTimeType"
          @change="handlePublishTimeTypeChange"
        >
          <el-radio label="now">立即发布</el-radio>
          <el-radio label="custom">自定义发布时间</el-radio>
        </el-radio-group>
        <el-date-picker
          v-if="publishTimeType === 'custom'"
          v-model="form.publishTime"
          type="datetime"
          placeholder="选择发布时间"
          style="width: 100%; margin-top: 10px"
          :disabled-date="disabledDate"
        />
      </el-form-item>

      <el-form-item label="详情" prop="content">
        <el-input
          v-model="form.content"
          type="textarea"
          :rows="8"
          placeholder="请输入详细内容"
        />
      </el-form-item>

      <el-form-item label="附件">
        <el-upload
          :action="uploadUrl"
          :headers="uploadHeaders"
          :on-success="handleUploadSuccess"
          :on-remove="handleRemove"
          :file-list="fileList"
          :before-upload="beforeUpload"
          multiple
        >
          <el-button type="primary">点击上传</el-button>
          <template #tip>
            <div class="el-upload__tip">
              支持上传图片（jpg/png）、文档（pdf/doc/docx）和表格（xls/xlsx），单个文件不超过1MB
            </div>
          </template>
        </el-upload>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ isEdit ? "保存" : "发布" }}
        </el-button>
        <el-button @click="handleBack">取消</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { ElMessage, type FormInstance } from "element-plus";
import axios from "../../utils/axios";

const router = useRouter();
const route = useRoute();
const formRef = ref<FormInstance>();
const submitting = ref(false);
const isEdit = ref(false);
const publishTimeType = ref("now");

const form = reactive({
  title: "",
  publisher: "业委会",
  publishTime: null as Date | null,
  content: "",
  attachments: [] as any[],
  type: route.query.type || "committee",
});

const fileList = ref<any[]>([]);

const rules = {
  title: [{ required: true, message: "请输入标题", trigger: "blur" }],
  publisher: [{ required: true, message: "请选择发布人", trigger: "change" }],
  content: [{ required: true, message: "请输入详细内容", trigger: "blur" }],
};

// 获取当前登录的小区ID和token
const getCommunityId = () => {
  try {
    const userStr = localStorage.getItem("admin-user");
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.communityId || "";
    }
  } catch (e) {
    console.error("获取用户信息失败:", e);
  }
  return "";
};

const communityId = getCommunityId();
const token = localStorage.getItem("admin-token") || "";

// 上传地址和请求头
const uploadUrl = `${import.meta.env.VITE_API_BASE_URL || "/api"}/upload`;
const uploadHeaders = {
  Authorization: `Bearer ${token}`,
};

// 禁用过去的日期
const disabledDate = (time: Date) => {
  return time.getTime() < Date.now() - 8.64e7; // 禁用昨天之前的日期
};

// 发布时间类型改变
const handlePublishTimeTypeChange = (value: string) => {
  if (value === "now") {
    form.publishTime = null;
  } else {
    form.publishTime = new Date();
  }
};

// 上传前检查
const beforeUpload = (file: File) => {
  const isValidType =
    file.type.startsWith("image/") ||
    file.type === "application/pdf" ||
    file.type === "application/msword" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.type === "application/vnd.ms-excel" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  if (!isValidType) {
    ElMessage.error("只支持上传图片、PDF、Word和Excel文档");
    return false;
  }

  const isLt1M = file.size / 1024 / 1024 < 1;
  if (!isLt1M) {
    ElMessage.error("文件大小不能超过1MB");
    return false;
  }

  return true;
};

// 上传成功
const handleUploadSuccess = (response: any, file: any) => {
  if (response.success) {
    form.attachments.push({
      name: file.name,
      url: response.url,
    });
    ElMessage.success("上传成功");
  } else {
    ElMessage.error("上传失败");
  }
};

// 移除文件
const handleRemove = (file: any) => {
  const index = form.attachments.findIndex((item) => item.name === file.name);
  if (index > -1) {
    form.attachments.splice(index, 1);
  }
};

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid) => {
    if (!valid) return;

    submitting.value = true;
    try {
      const data = {
        ...form,
        communityId,
        publishNow: publishTimeType.value === "now",
      };

      if (isEdit.value) {
        await axios.put(`/announcements/${route.query.id}`, data);
        ElMessage.success("保存成功");
      } else {
        await axios.post("/announcements", data);
        ElMessage.success("发布成功");
      }

      handleBack();
    } catch (error: any) {
      ElMessage.error(error.response?.data?.error || "操作失败");
    } finally {
      submitting.value = false;
    }
  });
};

// 返回
const handleBack = () => {
  router.back();
};

// 加载数据（编辑时）
const loadData = async () => {
  if (!route.query.id) return;

  try {
    const res = await axios.get(`/announcements/${route.query.id}`);
    const data = res.data;

    form.title = data.title;
    form.publisher = data.publisher;
    form.content = data.content;
    form.attachments = data.attachments || [];
    form.type = data.type;

    // 设置文件列表
    fileList.value = (data.attachments || []).map((item: any) => ({
      name: item.name,
      url: item.url,
    }));

    // 设置发布时间类型
    const now = new Date();
    const publishTime = new Date(data.publishTime);
    if (publishTime > now) {
      publishTimeType.value = "custom";
      form.publishTime = publishTime;
    } else {
      publishTimeType.value = "now";
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || "加载失败");
  }
};

onMounted(() => {
  isEdit.value = !!route.query.id;
  if (isEdit.value) {
    loadData();
  }
});
</script>

<style scoped>
.form-container {
  height: 100%;
  overflow-y: auto;
  background: #fff;
  padding: 20px;
}

.form-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
}

.form-header h2 {
  margin: 0;
  font-size: 20px;
}
</style>
