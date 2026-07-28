<template>
  <div class="community-info-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>小区基本情况</span>
          <el-button v-if="!isEditing" type="primary" @click="startEdit">
            编辑
          </el-button>
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
            <span class="unit">平方米</span>
          </template>
          <span v-else class="display-value"
            >{{ formData.landArea }} 平方米</span
          >
        </el-form-item>

        <el-form-item label="建筑面积">
          <template v-if="isEditing">
            <el-input-number
              v-model="formData.buildingArea"
              :min="0"
              :precision="2"
              :controls="true"
            />
            <span class="unit">平方米</span>
          </template>
          <span v-else class="display-value">
            {{ formData.buildingArea }} 平方米
          </span>
        </el-form-item>

        <el-form-item label="专有面积">
          <div v-if="isEditing" class="nested-fields">
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
              <span class="nested-label">商铺面积</span>
              <el-input-number
                v-model="formData.exclusiveArea.shop"
                :min="0"
                :precision="2"
                :controls="true"
              />
              <span class="unit">平方米</span>
            </div>
            <div class="nested-item">
              <span class="nested-label">其它面积</span>
              <el-input-number
                v-model="formData.exclusiveArea.other"
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
              <span class="nested-label">商铺面积</span>
              <span class="display-value"
                >{{ formData.exclusiveArea.shop }} 平方米</span
              >
            </div>
            <div class="nested-item-display">
              <span class="nested-label">其它面积</span>
              <span class="display-value"
                >{{ formData.exclusiveArea.other }} 平方米</span
              >
            </div>
          </div>
        </el-form-item>

        <el-form-item label="车库面积">
          <template v-if="isEditing">
            <el-input-number
              v-model="formData.parkingArea"
              :min="0"
              :precision="2"
              :controls="true"
            />
            <span class="unit">平方米</span>
          </template>
          <span v-else class="display-value"
            >{{ formData.parkingArea }} 平方米</span
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
          <div style="position: relative">
            <el-upload
              class="image-uploader"
              :action="uploadAction"
              :headers="uploadHeaders"
              :show-file-list="false"
              :on-success="(res: any) => handleImageSuccess(res, 'planImage')"
              :on-progress="(evt: any) => handleUploadProgress(evt, 'plan')"
              :before-upload="beforeImageUpload"
              :disabled="!isEditing"
            >
              <img
                v-if="formData.planImage"
                :src="formData.planImage"
                class="uploaded-image"
              />
              <el-icon v-else class="uploader-icon"><plus /></el-icon>
            </el-upload>
            <div
              v-if="uploadProgress.plan > 0 && uploadProgress.plan < 100"
              class="upload-progress-overlay"
            >
              <div class="progress-content">
                <el-progress
                  type="circle"
                  :percentage="uploadProgress.plan"
                  :width="80"
                />
                <div class="progress-text">上传中...</div>
              </div>
            </div>
          </div>
          <div class="upload-tip">建议上传小区平面布局图</div>
        </el-form-item>

        <el-form-item label="小区效果图">
          <div style="position: relative">
            <el-upload
              class="image-uploader"
              :action="uploadAction"
              :headers="uploadHeaders"
              :show-file-list="false"
              :on-success="(res: any) => handleImageSuccess(res, 'effectImage')"
              :on-progress="(evt: any) => handleUploadProgress(evt, 'effect')"
              :before-upload="beforeImageUpload"
              :disabled="!isEditing"
            >
              <img
                v-if="formData.effectImage"
                :src="formData.effectImage"
                class="uploaded-image"
              />
              <el-icon v-else class="uploader-icon"><plus /></el-icon>
            </el-upload>
            <div
              v-if="uploadProgress.effect > 0 && uploadProgress.effect < 100"
              class="upload-progress-overlay"
            >
              <div class="progress-content">
                <el-progress
                  type="circle"
                  :percentage="uploadProgress.effect"
                  :width="80"
                />
                <div class="progress-text">上传中...</div>
              </div>
            </div>
          </div>
          <div class="upload-tip">建议上传小区外观效果图</div>
        </el-form-item>

        <el-divider content-position="left">广告轮播图</el-divider>

        <el-form-item label="广告图片">
          <div class="ad-images-wrapper">
            <div
              v-for="(img, idx) in formData.adImages"
              :key="idx"
              class="ad-image-item"
            >
              <img :src="img" class="ad-thumbnail" />
              <div v-if="isEditing" class="ad-image-remove">
                <el-button
                  size="small"
                  type="danger"
                  circle
                  @click="removeAdImage(idx)"
                >
                  <el-icon><close /></el-icon>
                </el-button>
              </div>
            </div>
            <div
              v-if="isEditing && formData.adImages.length < 5"
              style="position: relative"
            >
              <el-upload
                class="image-uploader ad-image-uploader"
                :action="uploadAction"
                :headers="uploadHeaders"
                :show-file-list="false"
                :on-success="handleAdImageSuccess"
                :on-progress="handleAdUploadProgress"
                :before-upload="beforeImageUpload"
              >
                <el-icon class="uploader-icon"><plus /></el-icon>
              </el-upload>
              <div
                v-if="uploadProgress.ad > 0 && uploadProgress.ad < 100"
                class="upload-progress-overlay"
              >
                <div class="progress-content">
                  <el-progress
                    type="circle"
                    :percentage="uploadProgress.ad"
                    :width="80"
                  />
                  <div class="progress-text">上传中...</div>
                </div>
              </div>
            </div>
          </div>
          <div class="upload-tip">
            最多上传5张，建议尺寸750×300像素，将在小程序服务页顶部轮播展示
          </div>
        </el-form-item>

        <el-form-item v-if="isEditing">
          <div class="form-actions">
            <el-button size="large" @click="cancelEdit">取消</el-button>
            <el-button
              type="primary"
              :loading="loading"
              size="large"
              @click="handleSave"
            >
              保存
            </el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { Plus, Close } from "@element-plus/icons-vue";
import request from "../utils/axios";

const loading = ref(false);
const isEditing = ref(false);
const formRef = ref();
const originalData = ref<CommunityInfo | null>(null);
const uploadProgress = ref({
  plan: 0,
  effect: 0,
  ad: 0,
});

interface CommunityInfo {
  propertyName: string;
  buildingCount: number;
  unitCount: number;
  residentialCount: number;
  shopCount: number;
  ownerCount: number;
  landArea: number;
  buildingArea: number;
  exclusiveArea: {
    residential: number;
    shop: number;
    other: number;
  };
  parkingArea: number;
  surfaceParkingCount: number;
  undergroundParkingCount: number;
  vehicleCount: number;
  planImage: string;
  effectImage: string;
  adImages: string[];
}

const formData = ref<CommunityInfo>({
  propertyName: "",
  buildingCount: 0,
  unitCount: 0,
  residentialCount: 0,
  shopCount: 0,
  ownerCount: 0,
  landArea: 0,
  buildingArea: 0,
  exclusiveArea: {
    residential: 0,
    shop: 0,
    other: 0,
  },
  parkingArea: 0,
  surfaceParkingCount: 0,
  undergroundParkingCount: 0,
  vehicleCount: 0,
  planImage: "",
  effectImage: "",
  adImages: [],
});

const uploadAction = ref(
  `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/api/upload`,
);

const uploadHeaders = ref({
  Authorization: `Bearer ${localStorage.getItem("admin-token") || ""}`,
});

async function loadData() {
  try {
    loading.value = true;
    const userData = await request.get("/me");
    console.log("用户数据:", userData);
    const communityId = userData.user?.communityId;
    console.log("当前用户的communityId:", communityId);

    if (!communityId) {
      ElMessage.warning("未找到小区信息");
      return;
    }

    const res = await request.get(`/community-info/${communityId}`);
    console.log("API返回的完整数据:", res);
    if (res) {
      formData.value = {
        ...formData.value,
        ...res,
      };
      console.log("formData更新后:", formData.value);
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

function handleAdUploadProgress(evt: any) {
  if (evt.percent) {
    uploadProgress.value.ad = Math.floor(evt.percent);
  }
}

function handleAdImageSuccess(res: any) {
  uploadProgress.value.ad = 0;
  if (res.url) {
    formData.value.adImages = [...formData.value.adImages, res.url];
    ElMessage.success("上传成功");
  } else {
    ElMessage.error("上传失败");
  }
}

function removeAdImage(idx: number) {
  formData.value.adImages = formData.value.adImages.filter((_, i) => i !== idx);
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

.upload-progress-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  z-index: 10;
}

.progress-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.progress-text {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
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

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding-top: 20px;
}

/* 广告图片 */
.ad-images-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
}

.ad-image-item {
  position: relative;
  width: 160px;
  height: 64px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
}

.ad-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.ad-image-remove {
  position: absolute;
  top: 4px;
  right: 4px;
}

.ad-image-uploader {
  width: 160px !important;
  height: 64px !important;
}

.ad-image-uploader .uploader-icon {
  width: 160px !important;
  height: 64px !important;
  font-size: 22px;
}
</style>
