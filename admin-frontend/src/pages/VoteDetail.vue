<template>
  <div class="vote-detail-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>投票详情 - {{ voteTitle }}</span>
          <el-button @click="goBack">返回</el-button>
        </div>
      </template>

      <el-table
        :data="voteRecords"
        stripe
        style="width: 100%"
        row-key="_id"
        v-loading="loading"
      >
        <el-table-column type="expand" v-if="hasMultipleProperties">
          <template #default="{ row }">
            <div
              v-if="row.properties && row.properties.length > 0"
              style="padding: 0 50px"
            >
              <el-table :data="row.properties" :show-header="true" size="small">
                <el-table-column
                  prop="district"
                  label="区/期号"
                  min-width="100"
                />
                <el-table-column
                  prop="building"
                  label="楼栋号"
                  min-width="80"
                />
                <el-table-column prop="unit" label="单元号" min-width="80" />
                <el-table-column prop="room" label="房号" min-width="80" />
                <el-table-column
                  prop="area"
                  label="专有面积(㎡)"
                  min-width="120"
                />
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="ownerName" label="户主姓名" min-width="100" />
        <el-table-column prop="ownerPhone" label="手机号" min-width="120" />
        <el-table-column prop="district" label="区/期号" min-width="100" />
        <el-table-column prop="building" label="楼栋号" min-width="80" />
        <el-table-column prop="unit" label="单元号" min-width="80" />
        <el-table-column prop="room" label="房号" min-width="80" />
        <el-table-column prop="area" label="专有面积(㎡)" min-width="120" />
        <el-table-column label="手写签名" min-width="120">
          <template #default="{ row }">
            <img
              v-if="row.signatureUrl"
              :src="row.signatureUrl"
              @click="handlePreviewSignature(row.signatureUrl)"
              style="
                width: 80px;
                height: 40px;
                object-fit: contain;
                cursor: pointer;
                border: 1px solid #ddd;
                border-radius: 4px;
              "
            />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="投票选项" min-width="150">
          <template #default="{ row }">
            <el-tag type="success">{{ row.optionText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="投票时间" min-width="180">
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadRecords"
        @current-change="loadRecords"
        style="margin-top: 16px; justify-content: center"
        :pager-count="7"
      />
    </el-card>

    <!-- 投票统计已移至“数据统计”弹窗（投票管理页面的操作中） -->

    <!-- 签名预览对话框 -->
    <el-dialog
      v-model="signaturePreviewVisible"
      title=""
      fullscreen
      :close-on-click-modal="true"
      :show-close="true"
      class="image-preview-dialog"
      :modal="true"
    >
      <div class="preview-container" @click="signaturePreviewVisible = false">
        <div class="preview-main">
          <img :src="currentSignature" class="preview-image" />
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import request from "@/utils/axios";

const route = useRoute();
const router = useRouter();

const voteId = ref(route.params.id as string);
const voteTitle = ref("");
const voteRecords = ref<any[]>([]);
// 投票统计通过管理页面的“数据统计”获取，此处不再维护本地 options
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);
const loading = ref(false);

// 签名预览
const signaturePreviewVisible = ref(false);
const currentSignature = ref("");

// 检查是否有多套房产的数据
const hasMultipleProperties = computed(() => {
  return voteRecords.value.some(
    (item) => item.properties && item.properties.length > 0
  );
});

async function loadRecords() {
  loading.value = true;
  try {
    const data = await request.get(`/votes/${voteId.value}/records`, {
      params: {
        page: currentPage.value,
        pageSize: pageSize.value,
      },
    });

    voteRecords.value = data.data || [];
    total.value = data.total || 0;
    voteTitle.value = data.voteTitle || "";
  } catch (err) {
    console.error("加载投票记录失败:", err);
    ElMessage.error("加载失败");
  } finally {
    loading.value = false;
  }
}

function formatTime(dateStr: string) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function goBack() {
  router.back();
}

function handlePreviewSignature(url: string) {
  currentSignature.value = url;
  signaturePreviewVisible.value = true;
}

onMounted(() => {
  loadRecords();
});
</script>

<style scoped>
.vote-detail-page {
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.vote-statistics {
  padding: 20px;
}

/* 签名预览对话框样式 */
.image-preview-dialog {
  overflow: hidden !important;
}

.image-preview-dialog .el-dialog {
  background: transparent !important;
  box-shadow: none !important;
  margin: 0 !important;
  overflow: hidden !important;
}

.image-preview-dialog .el-overlay {
  background-color: rgba(0, 0, 0, 0.85) !important;
}

.image-preview-dialog .el-dialog__body {
  padding: 0 !important;
  height: 100vh !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: hidden !important;
}

.image-preview-dialog .el-dialog__header {
  display: none !important;
}

.image-preview-dialog .el-dialog__headerbtn {
  position: fixed !important;
  top: 20px !important;
  right: 20px !important;
  width: 50px !important;
  height: 50px !important;
  z-index: 9999 !important;
}

.image-preview-dialog .el-dialog__headerbtn .el-dialog__close {
  color: #fff !important;
  font-size: 32px !important;
}

.preview-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
}

.preview-main {
  max-width: 90%;
  max-height: 90%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-image {
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
  user-select: none;
}
</style>
