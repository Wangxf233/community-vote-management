<template>
  <div class="community-info-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>小区基本情况</span>
          <div class="button-group">
            <el-button v-if="!isEditing" type="primary" @click="startEdit">
              编辑
            </el-button>
            <template v-else>
              <el-button @click="cancelEdit">取消</el-button>
              <el-button type="primary" @click="handleSave" :loading="loading">
                保存
              </el-button>
            </template>
          </div>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="formData"
        label-width="140px"
        style="max-width: 800px"
      >
        <el-divider content-position="left">物业信息</el-divider>

        <el-form-item label="物业名称">
          <template v-if="isEditing">
            <el-input
              v-model="formData.propertyName"
              placeholder="请输入物业名称"
              maxlength="50"
              show-word-limit
            />
          </template>
          <span v-else class="display-value">{{
            formData.propertyName || "未设置"
          }}</span>
        </el-form-item>

        <el-divider content-position="left">基本信息</el-divider>

        <el-form-item label="楼栋数量">
          <template v-if="isEditing">
            <el-input-number
              v-model="formData.buildingCount"
              :min="0"
              :controls="true"
            />
            <span class="unit">栋</span>
          </template>
          <span v-else class="display-value"
            >{{ formData.buildingCount }} 栋</span
          >
        </el-form-item>

        <el-form-item label="单元数量">
          <template v-if="isEditing">
            <el-input-number
              v-model="formData.unitCount"
              :min="0"
              :controls="true"
            />
            <span class="unit">单元</span>
          </template>
          <span v-else class="display-value"
            >{{ formData.unitCount }} 单元</span
          >
        </el-form-item>

        <el-form-item label="住宅数量">
          <template v-if="isEditing">
            <el-input-number
              v-model="formData.residentialCount"
              :min="0"
              :controls="true"
            />
            <span class="unit">户</span>
          </template>
          <span v-else class="display-value"
            >{{ formData.residentialCount }} 户</span
          >
        </el-form-item>

        <el-form-item label="商铺数量">
          <template v-if="isEditing">
            <el-input-number
              v-model="formData.shopCount"
              :min="0"
              :controls="true"
            />
            <span class="unit">户</span>
          </template>
          <span v-else class="display-value">{{ formData.shopCount }} 户</span>
        </el-form-item>

        <el-form-item label="业主数量">
          <template v-if="isEditing">
            <el-input-number
              v-model="formData.ownerCount"
              :min="0"
              :controls="true"
            />
            <span class="unit">人</span>
          </template>
          <span v-else class="display-value">{{ formData.ownerCount }} 人</span>
        </el-form-item>

        <el-divider content-position="left">占地与面积</el-divider>

        <el-form-item label="占地面积">
          <template v-if="isEditing">
            <el-input-number
              v-model="formData.landArea"
              :min="0"
              :precision="2"
              :controls="true"
            />
            <span class="unit">亩</span>
          </template>
          <span v-else class="display-value">{{ formData.landArea }} 亩</span>
        </el-form-item>

        <el-form-item label="建筑面积">
          <div class="nested-fields" v-if="isEditing">
            <div class="nested-item">
              <span class="nested-label">住宅面积</span>
              <el-input-number
                v-model="formData.buildingArea.residential"
                :min="0"
                :precision="2"
                :controls="true"
              />
              <span class="unit">平方米</span>
            </div>
            <div class="nested-item">
              <span class="nested-label">商户面积</span>
              <el-input-number
                v-model="formData.buildingArea.commercial"
                :min="0"
                :precision="2"
                :controls="true"
              />
              <span class="unit">平方米</span>
            </div>
          </div>
          <div v-else class="nested-display">
            <div class="nested-item-display">
              <span class="nested-label">住宅面积</span>
              <span class="display-value"
                >{{ formData.buildingArea.residential }} 平方米</span
              >
            </div>
            <div class="nested-item-display">
              <span class="nested-label">商户面积</span>
              <span class="display-value"
                >{{ formData.buildingArea.commercial }} 平方米</span
              >
            </div>
          </div>
        </el-form-item>

        <el-form-item label="专有面积">
          <div class="nested-fields" v-if="isEditing">
            <div class="nested-item">
              <span class="nested-label">住宅面积</span>
              <el-input-number
                v-model="formData.exclusiveArea.residential"
                :min="0"
                :precision="2"
                :controls="true"
              />
              <span class="unit">平方米</span>
            </div>
            <div class="nested-item">
              <span class="nested-label">商户面积</span>
              <el-input-number
                v-model="formData.exclusiveArea.commercial"
                :min="0"
                :precision="2"
                :controls="true"
              />
              <span class="unit">平方米</span>
            </div>
          </div>
          <div v-else class="nested-display">
            <div class="nested-item-display">
              <span class="nested-label">住宅面积</span>
              <span class="display-value"
                >{{ formData.exclusiveArea.residential }} 平方米</span
              >
            </div>
            <div class="nested-item-display">
              <span class="nested-label">商户面积</span>
              <span class="display-value"
                >{{ formData.exclusiveArea.commercial }} 平方米</span
              >
            </div>
          </div>
        </el-form-item>

        <el-form-item label="地下车库面积">
          <template v-if="isEditing">
            <el-input-number
              v-model="formData.undergroundParkingArea"
              :min="0"
              :precision="2"
              :controls="true"
            />
            <span class="unit">平方米</span>
          </template>
          <span v-else class="display-value"
            >{{ formData.undergroundParkingArea }} 平方米</span
          >
        </el-form-item>

        <el-divider content-position="left">车位与车辆</el-divider>

        <el-form-item label="地面车位数量">
          <template v-if="isEditing">
            <el-input-number
              v-model="formData.surfaceParkingCount"
              :min="0"
              :controls="true"
            />
            <span class="unit">个</span>
          </template>
          <span v-else class="display-value"
            >{{ formData.surfaceParkingCount }} 个</span
          >
        </el-form-item>

        <el-form-item label="地下车位数量">
          <template v-if="isEditing">
            <el-input-number
              v-model="formData.undergroundParkingCount"
              :min="0"
              :controls="true"
            />
            <span class="unit">个</span>
          </template>
          <span v-else class="display-value"
            >{{ formData.undergroundParkingCount }} 个</span
          >
        </el-form-item>

        <el-form-item label="车辆数量">
          <template v-if="isEditing">
            <el-input-number
              v-model="formData.vehicleCount"
              :min="0"
              :controls="true"
            />
            <span class="unit">辆</span>
          </template>
          <span v-else class="display-value"
            >{{ formData.vehicleCount }} 辆</span
          >
        </el-form-item>

        <el-divider content-position="left">图片资料</el-divider>

        <el-form-item label="小区平面图">
          <el-upload
            class="image-uploader"
            :action="uploadAction"
            :headers="uploadHeaders"
            :show-file-list="false"
            :on-success="(res) => handleImageSuccess(res, 'planImage')"
            :on-progress="(evt) => handleUploadProgress(evt, 'plan')"
            :before-upload="beforeImageUpload"
            :disabled="!isEditing"
          >
            <img
              v-if="formData.planImage"
              :src="formData.planImage"
              class="uploaded-image"
            />
            <el-icon v-else class="uploader-icon"><Plus /></el-icon>
            <div
              v-if="uploadProgress.plan > 0 && uploadProgress.plan < 100"
              class="upload-progress"
            >
              <el-progress
                :percentage="uploadProgress.plan"
                :stroke-width="6"
              />
            </div>
          </el-upload>
          <div class="upload-tip">建议上传小区平面布局图</div>
        </el-form-item>

        <el-form-item label="小区效果图">
          <el-upload
            class="image-uploader"
            :action="uploadAction"
            :headers="uploadHeaders"
            :show-file-list="false"
            :on-success="(res) => handleImageSuccess(res, 'effectImage')"
            :on-progress="(evt) => handleUploadProgress(evt, 'effect')"
            :before-upload="beforeImageUpload"
            :disabled="!isEditing"
          >
            <img
              v-if="formData.effectImage"
              :src="formData.effectImage"
              class="uploaded-image"
            />
            <el-icon v-else class="uploader-icon"><Plus /></el-icon>
            <div
              v-if="uploadProgress.effect > 0 && uploadProgress.effect < 100"
              class="upload-progress"
            >
              <el-progress
                :percentage="uploadProgress.effect"
                :stroke-width="6"
              />
            </div>
          </el-upload>
          <div class="upload-tip">建议上传小区外观效果图</div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import request from "../utils/axios";

const loading = ref(false);
const isEditing = ref(false);
const formRef = ref();
const originalData = ref<CommunityInfo | null>(null);
const uploadProgress = ref({
  plan: 0,
  effect: 0,
});

interface CommunityInfo {
  propertyName: string;
  buildingCount: number;
  unitCount: number;
  residentialCount: number;
  shopCount: number;
  ownerCount: number;
  landArea: number;
  buildingArea: {
    residential: number;
    commercial: number;
  };
  exclusiveArea: {
    residential: number;
    commercial: number;
  };
  undergroundParkingArea: number;
  surfaceParkingCount: number;
  undergroundParkingCount: number;
  vehicleCount: number;
  planImage: string;
  effectImage: string;
}

const formData = ref<CommunityInfo>({
  propertyName: "",
  buildingCount: 0,
  unitCount: 0,
  residentialCount: 0,
  shopCount: 0,
  ownerCount: 0,
  landArea: 0,
  buildingArea: {
    residential: 0,
    commercial: 0,
  },
  exclusiveArea: {
    residential: 0,
    commercial: 0,
  },
  undergroundParkingArea: 0,
  surfaceParkingCount: 0,
  undergroundParkingCount: 0,
  vehicleCount: 0,
  planImage: "",
  effectImage: "",
});

const uploadAction = ref(
  `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/api/upload`
);

const uploadHeaders = ref({
  Authorization: `Bearer ${localStorage.getItem("admin-token") || ""}`,
});

async function loadData() {
  try {
    loading.value = true;
    const userData = await request.get("/me");
    const communityId = userData.user?.communityId;

    if (!communityId) {
      ElMessage.warning("未找到小区信息");
      return;
    }

    const res = await request.get(`/community-info/${communityId}`);
    if (res.data) {
      formData.value = {
        ...formData.value,
        ...res.data,
      };
      // 保存原始数据用于取消编辑时恢复
      originalData.value = JSON.parse(JSON.stringify(formData.value));
    }
  } catch (err: any) {
    console.error(err);
    if (err.response?.status !== 404) {
      ElMessage.error("加载数据失败");
    }
  } finally {
    loading.value = false;
  }
}

function startEdit() {
  isEditing.value = true;
  // 保存当前数据作为备份
  originalData.value = JSON.parse(JSON.stringify(formData.value));
}

function cancelEdit() {
  if (originalData.value) {
    // 恢复原始数据
    formData.value = JSON.parse(JSON.stringify(originalData.value));
  }
  isEditing.value = false;
}

async function handleSave() {
  try {
    loading.value = true;
    const userData = await request.get("/me");
    const communityId = userData.user?.communityId;

    if (!communityId) {
      ElMessage.warning("未找到小区信息");
      return;
    }

    await request.put(`/community-info/${communityId}`, formData.value);
    ElMessage.success("保存成功");
    isEditing.value = false;
    // 更新原始数据
    originalData.value = JSON.parse(JSON.stringify(formData.value));
  } catch (err) {
    console.error(err);
    ElMessage.error("保存失败");
  } finally {
    loading.value = false;
  }
}

function handleUploadProgress(evt: any, type: "plan" | "effect") {
  if (evt.percent) {
    uploadProgress.value[type] = Math.floor(evt.percent);
  }
}

function handleImageSuccess(res: any, field: "planImage" | "effectImage") {
  // 重置对应的进度
  const progressKey = field === "planImage" ? "plan" : "effect";
  uploadProgress.value[progressKey] = 0;

  if (res.url) {
    formData.value[field] = res.url;
    ElMessage.success("上传成功");
  } else {
    ElMessage.error("上传失败");
  }
}

function beforeImageUpload(file: File) {
  const isImage = file.type.startsWith("image/");
  const isLt5M = file.size / 1024 / 1024 < 5;

  if (!isImage) {
    ElMessage.error("只能上传图片文件!");
  }
  if (!isLt5M) {
    ElMessage.error("图片大小不能超过 5MB!");
  }
  return isImage && isLt5M;
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.community-info-page {
  height: 100%;
  overflow: auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.button-group {
  display: flex;
  gap: 8px;
}

.unit {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
}

.nested-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nested-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nested-label {
  min-width: 80px;
  color: var(--el-text-color-regular);
}

.image-uploader {
  width: 200px;
  height: 200px;
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  cursor: pointer;
  overflow: hidden;
  transition: var(--el-transition-duration-fast);
  position: relative;
}

.image-uploader:hover {
  border-color: var(--el-color-primary);
}

.upload-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px;
  background: rgba(255, 255, 255, 0.9);
}

.uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.uploaded-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.upload-tip {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.display-value {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.nested-display {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nested-item-display {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
