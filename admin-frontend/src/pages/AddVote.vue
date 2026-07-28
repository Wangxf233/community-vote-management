<template>
  <div
    style="
      height: calc(100vh - 96px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    "
  >
    <el-card>
      <el-form :model="form" label-width="120px">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" placeholder="请输入标题" />
        </el-form-item>

        <el-form-item label="详情" required>
          <el-input
            v-model="form.detail"
            type="textarea"
            :rows="6"
            placeholder="请输入详情"
          />
        </el-form-item>

        <el-form-item label="附件">
          <el-upload
            :action="uploadUrl"
            :headers="uploadHeaders"
            :on-success="onUploadSuccess"
            :on-error="onUploadError"
            :on-remove="onRemoveFile"
            :before-upload="beforeUpload"
            :file-list="fileList"
            :limit="1"
            :on-exceed="onExceed"
          >
            <el-button type="primary" :loading="uploading">
              {{ uploading ? "上传中..." : "上传附件" }}
            </el-button>
            <template #tip>
              <div style="color: #999; font-size: 12px">
                支持文档或图片，最大10MB
              </div>
            </template>
          </el-upload>
        </el-form-item>

        <el-form-item label="发起人" required>
          <el-select v-model="form.initiator" placeholder="请选择发起人">
            <el-option label="业委会" value="业委会" />
            <el-option label="物业公司" value="物业公司" />
          </el-select>
        </el-form-item>

        <el-form-item label="发布时间" required>
          <el-radio-group v-model="publishMode" @change="onPublishModeChange">
            <el-radio label="now">立即发布</el-radio>
            <el-radio label="custom">自定义时间</el-radio>
          </el-radio-group>
          <el-date-picker
            v-if="publishMode === 'custom'"
            v-model="form.publishTime"
            type="datetime"
            placeholder="选择发布时间"
            style="margin-left: 12px; width: 300px"
          />
        </el-form-item>

        <el-form-item label="截止时间" required>
          <div>
            <el-radio-group
              v-model="deadlineMode"
              @change="onDeadlineModeChange"
            >
              <el-radio label="1d">1天</el-radio>
              <el-radio label="3d">3天</el-radio>
              <el-radio label="7d">7天</el-radio>
              <el-radio label="1m">1个月</el-radio>
              <el-radio label="custom">自定义</el-radio>
            </el-radio-group>
            <div v-if="deadlineMode === 'custom'" style="margin-top: 12px">
              <el-date-picker
                v-model="form.deadlineTime"
                type="datetime"
                placeholder="选择截止时间"
                style="width: 300px"
              />
            </div>
            <div
              v-else-if="form.deadlineTime"
              style="margin-top: 8px; color: #666"
            >
              截止时间：{{ formatDateTime(form.deadlineTime) }}
            </div>
          </div>
        </el-form-item>

        <el-form-item label="投票说明">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="4"
            placeholder="请输入投票说明"
          />
        </el-form-item>

        <el-form-item label="投票选项">
          <el-alert
            title="投票选项固定为：同意、不同意、弃权"
            type="info"
            :closable="false"
            show-icon
          />
        </el-form-item>

        <el-form-item label="小程序结果展示">
          <el-switch v-model="form.showResult" />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            :loading="submitting"
            :disabled="submitting"
            @click="onSubmit"
          >
            {{ submitting ? "提交中..." : "提交" }}
          </el-button>
          <el-button type="success" :disabled="submitting" @click="saveDraft"
            >保存</el-button
          >
          <el-button :disabled="submitting" @click="onCancel">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import request from "@/utils/axios";

const router = useRouter();
const route = useRoute();

const voteType = computed(() => route.query.type || "vote");
const draftKey = computed(() => `vote-draft-${voteType.value}`);

const form = reactive({
  title: "",
  detail: "",
  attachment: "",
  attachmentName: "",
  initiator: "",
  publishTime: null as Date | null,
  deadlineTime: null as Date | null,
  description: "",
  showResult: false,
});

const publishMode = ref<"now" | "custom">("now");
const deadlineMode = ref<"1d" | "3d" | "7d" | "1m" | "custom">("7d");
const fileList = ref<any[]>([]);
const submitting = ref(false);
const uploading = ref(false);

const uploadUrl = "/api/upload";
const uploadHeaders = computed(() => {
  const token = localStorage.getItem("admin-token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
});

function formatDateTime(val: any) {
  if (!val) return "";
  try {
    const d = new Date(val);
    return d.toLocaleString("zh-CN");
  } catch {
    return "";
  }
}

function onPublishModeChange() {
  if (publishMode.value === "now") {
    form.publishTime = null;
  }
}

function onDeadlineModeChange() {
  if (deadlineMode.value === "custom") {
    form.deadlineTime = null;
    return;
  }

  const base = form.publishTime || new Date();
  const now = new Date(base);

  switch (deadlineMode.value) {
    case "1d":
      now.setDate(now.getDate() + 1);
      break;
    case "3d":
      now.setDate(now.getDate() + 3);
      break;
    case "7d":
      now.setDate(now.getDate() + 7);
      break;
    case "1m":
      now.setMonth(now.getMonth() + 1);
      break;
  }

  form.deadlineTime = now;
}

function beforeUpload(file: File) {
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    ElMessage.error("文件大小不能超过10MB");
    return false;
  }
  console.log("Starting upload:", file.name, file.size);
  // 确认已登录并携带 token
  const token = localStorage.getItem("admin-token") || "";
  if (!token) {
    ElMessage.error("未登录或登录已过期，请先登录");
    return false;
  }

  uploading.value = true;
  ElMessage.info("上传中，请稍候...");
  return true;
}

function onUploadError(error: any) {
  console.error("Upload error:", error);
  uploading.value = false;

  // 尝试解析后端返回的错误信息
  try {
    const status = error?.status || (error?.response && error.response.status);
    const respText =
      (error && error.response && error.response.data) || error?.message || "";

    // 如果是未授权（401）或后端返回 invalid_token，提示重新登录
    if (status === 401 || /invalid_token/.test(String(respText))) {
      ElMessage.error("登录已过期或无效，请重新登录");
      // 清理本地 token 并跳转到登录页（假设路由存在）
      localStorage.removeItem("admin-token");
      setTimeout(() => {
        router.push({ path: "/login" });
      }, 600);
      return;
    }
  } catch (e) {
    console.warn("解析上传错误失败", e);
  }

  ElMessage.error("上传失败，请重试");
}

function onExceed() {
  ElMessage.warning("最多只能上传1个文件");
}

function onRemoveFile() {
  form.attachment = "";
  form.attachmentName = "";
  fileList.value = [];
  uploading.value = false;
  ElMessage.info("已删除附件");
}

function onUploadSuccess(response: any, file: any) {
  console.log("Upload response:", response);
  uploading.value = false;

  if (response.success) {
    form.attachment = response.url;
    form.attachmentName = response.name || file.name || "";

    // 更新文件列表显示
    fileList.value = [
      {
        name: form.attachmentName,
        url: response.url,
        status: "success",
      },
    ];

    ElMessage.success("上传成功");
  } else {
    ElMessage.error(response.error || "上传失败");
  }
}

function saveDraft() {
  try {
    const draft = {
      title: form.title,
      detail: form.detail,
      attachment: form.attachment,
      attachmentName: form.attachmentName,
      initiator: form.initiator,
      publishTime: form.publishTime ? form.publishTime.toISOString() : null,
      deadlineTime: form.deadlineTime ? form.deadlineTime.toISOString() : null,
      description: form.description,
      showResult: form.showResult,
      publishMode: publishMode.value,
      deadlineMode: deadlineMode.value,
    };
    localStorage.setItem(draftKey.value, JSON.stringify(draft));
    ElMessage.success("保存成功");
  } catch (e) {
    console.error(e);
    ElMessage.error("保存失败");
  }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(draftKey.value);
    if (raw) {
      const draft = JSON.parse(raw);
      form.title = draft.title || "";
      form.detail = draft.detail || "";
      form.attachment = draft.attachment || "";
      form.attachmentName = draft.attachmentName || "";
      form.initiator = draft.initiator || "";
      form.publishTime = draft.publishTime ? new Date(draft.publishTime) : null;
      form.deadlineTime = draft.deadlineTime
        ? new Date(draft.deadlineTime)
        : null;
      form.description = draft.description || "";
      form.showResult = draft.showResult || false;
      publishMode.value = draft.publishMode || "now";
      deadlineMode.value = draft.deadlineMode || "7d";

      // 恢复附件列表显示
      if (form.attachment && form.attachmentName) {
        fileList.value = [
          {
            name: form.attachmentName,
            url: form.attachment,
          },
        ];
      }
    }
  } catch (e) {
    console.error(e);
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(draftKey.value);
  } catch (e) {
    console.error(e);
  }
}

async function onSubmit() {
  if (!form.title) {
    ElMessage.warning("请输入标题");
    return;
  }
  if (!form.detail) {
    ElMessage.warning("请输入详情");
    return;
  }
  if (!form.initiator) {
    ElMessage.warning("请选择发起人");
    return;
  }

  const publishTime =
    publishMode.value === "now" ? new Date() : form.publishTime;
  if (!publishTime) {
    ElMessage.warning("请选择发布时间");
    return;
  }

  if (!form.deadlineTime) {
    ElMessage.warning("请选择截止时间");
    return;
  }

  if (submitting.value) return;
  submitting.value = true;

  try {
    const user = JSON.parse(localStorage.getItem("admin-user") || "{}");
    const communityId = user.communityId;

    if (!communityId) {
      ElMessage.error("未找到小区信息");
      submitting.value = false;
      return;
    }

    const body = await request.post("/votes", {
      communityId,
      type: voteType.value,
      title: form.title,
      detail: form.detail,
      attachment: form.attachment,
      attachmentName: form.attachmentName,
      initiator: form.initiator,
      publishTime: publishTime.toISOString(),
      deadlineTime: form.deadlineTime.toISOString(),
      description: form.description,
      showResult: form.showResult,
    });

    ElMessage.success("创建成功");
    clearDraft();
    submitting.value = false;

    setTimeout(() => {
      router.push({
        path: "/community-admin/votes",
        query: { type: voteType.value },
      });
    }, 500);
  } catch (e: any) {
    ElMessage.error(e.message || "创建失败");
    submitting.value = false;
  }
}
function onCancel() {
  router.push({
    path: "/community-admin/votes",
    query: { type: voteType.value },
  });
}

onMounted(() => {
  loadDraft(); // 加载草稿
  if (!form.deadlineTime) {
    onDeadlineModeChange(); // 初始化默认截止时间
  }
});
</script>
