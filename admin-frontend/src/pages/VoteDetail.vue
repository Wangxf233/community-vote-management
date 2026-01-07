<template>
  <div class="vote-detail-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>投票详情 - {{ voteTitle }}</span>
          <div>
            <el-button
              type="success"
              @click="exportToExcel"
              :loading="exporting"
            >
              <template v-if="!exporting">导出Excel</template>
              <template v-else>导出中 {{ exportProgress }}%</template>
            </el-button>
            <el-button @click="goBack">返回</el-button>
          </div>
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
import * as ExcelJS from "exceljs";

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

// 导出相关
const exporting = ref(false);
const exportProgress = ref(0);

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

async function exportToExcel() {
  if (exporting.value) return;

  try {
    exporting.value = true;
    exportProgress.value = 0;

    // 获取投票统计数据
    exportProgress.value = 5;
    const statisticsData = await request.get(
      `/votes/${voteId.value}/statistics`
    );
    const statistics = statisticsData.data || {};

    // 获取所有投票记录数据（不分页）
    exportProgress.value = 10;
    const data = await request.get(`/votes/${voteId.value}/records`, {
      params: {
        page: 1,
        pageSize: 999999,
      },
    });

    const allRecords = data.data || [];
    const voteInfo = {
      title: data.voteTitle || voteTitle.value,
      initiator: data.voteInitiator || "未知",
    };
    exportProgress.value = 15;

    if (allRecords.length === 0) {
      ElMessage.warning("暂无数据可导出");
      return;
    }

    // 创建工作簿
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("投票记录");

    // 第一行：投票标题和发起人
    const titleRow = worksheet.addRow([
      `投票标题：${voteInfo.title}`,
      "",
      "",
      "",
      "",
      `发起人：${voteInfo.initiator}`,
      "",
      "",
      "",
      "",
      "",
    ]);
    titleRow.font = { bold: true, size: 14 };
    titleRow.height = 25;
    // 合并第一行的前5列（标题）
    worksheet.mergeCells("A1:E1");
    worksheet.getCell("A1").alignment = {
      vertical: "middle",
      horizontal: "left",
    };
    // 合并第一行的后6列（发起人）
    worksheet.mergeCells("F1:K1");
    worksheet.getCell("F1").alignment = {
      vertical: "middle",
      horizontal: "left",
    };

    // 第二行：空行分隔
    worksheet.addRow([]);

    // 第三行：统计数据标题
    const statsHeaderRow = worksheet.addRow(["投票统计数据"]);
    statsHeaderRow.font = { bold: true, size: 12 };
    worksheet.mergeCells(`A${statsHeaderRow.number}:K${statsHeaderRow.number}`);
    worksheet.getCell(`A${statsHeaderRow.number}`).alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    // 第四行：总人数和参与人数
    const row4 = worksheet.addRow([
      "总人数",
      statistics.totalCount || 0,
      "",
      "参与人数",
      statistics.participantCount || 0,
    ]);
    row4.font = { bold: true };
    row4.alignment = { vertical: "middle", horizontal: "center" };

    // 第五行：同意/不同意/弃权人数
    const row5 = worksheet.addRow([
      "同意人数",
      `${statistics.agreeCount || 0} (${statistics.agreePercent || 0}%)`,
      "",
      "不同意人数",
      `${statistics.disagreeCount || 0} (${statistics.disagreePercent || 0}%)`,
      "",
      "弃权人数",
      `${statistics.abstainCount || 0} (${statistics.abstainPercent || 0}%)`,
    ]);
    row5.font = { bold: true };
    row5.alignment = { vertical: "middle", horizontal: "center" };

    // 第六行：专有面积统计
    const row6 = worksheet.addRow([
      "同意专有面积(㎡)",
      `${statistics.agreeArea || 0} (${statistics.agreeAreaPercent || 0}%)`,
      "",
      "不同意专有面积(㎡)",
      `${statistics.disagreeArea || 0} (${
        statistics.disagreeAreaPercent || 0
      }%)`,
      "",
      "弃权专有面积(㎡)",
      `${statistics.abstainArea || 0} (${statistics.abstainAreaPercent || 0}%)`,
    ]);
    row6.font = { bold: true };
    row6.alignment = { vertical: "middle", horizontal: "center" };

    // 第七行：空行分隔
    worksheet.addRow([]);

    // 第八行：投票详情列表标题
    const detailHeaderRow = worksheet.addRow(["投票详情列表"]);
    detailHeaderRow.font = { bold: true, size: 12 };
    worksheet.mergeCells(
      `A${detailHeaderRow.number}:K${detailHeaderRow.number}`
    );
    worksheet.getCell(`A${detailHeaderRow.number}`).alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    // 第九行：列表数据表头
    const dataHeaderRow = worksheet.addRow([
      "户主姓名",
      "手机号",
      "区/期号",
      "楼栋号",
      "单元号",
      "房号",
      "专有面积(㎡)",
      "手写签名",
      "投票选项",
      "投票时间",
      "房产类型",
    ]);

    // 设置列宽
    worksheet.columns = [
      { key: "name", width: 12 },
      { key: "phone", width: 15 },
      { key: "district", width: 12 },
      { key: "building", width: 10 },
      { key: "unit", width: 10 },
      { key: "room", width: 12 },
      { key: "area", width: 15 },
      { key: "signature", width: 20 },
      { key: "option", width: 15 },
      { key: "time", width: 20 },
      { key: "type", width: 12 },
    ];

    // 设置数据表头样式
    dataHeaderRow.font = { bold: true };
    dataHeaderRow.alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    exportProgress.value = 20;

    const totalRecords = allRecords.length;
    let currentRow = dataHeaderRow.number + 1; // 从数据表头的下一行开始

    for (let i = 0; i < totalRecords; i++) {
      const record = allRecords[i];

      // 添加主房产信息
      const mainRow = worksheet.addRow({
        name: record.ownerName || "-",
        phone: record.ownerPhone || "-",
        district: record.district || "-",
        building: record.building || "-",
        unit: record.unit || "-",
        room: record.room || "-",
        area: record.area || 0,
        signature: "", // 图片占位
        option: record.optionText || "-",
        time: formatTime(record.createdAt),
        type: "主房产",
      });

      // 设置数据行居中对齐
      mainRow.alignment = { vertical: "middle", horizontal: "center" };

      // 如果有签名图片，插入到Excel中
      if (record.signatureUrl) {
        try {
          // 通过后端代理获取图片，避免CORS问题
          const response = await request.get("/votes/proxy-image", {
            params: { url: record.signatureUrl },
            responseType: "arraybuffer",
          });

          const arrayBuffer = response;

          // 根据URL判断图片类型
          let extension = "png";
          if (
            record.signatureUrl.includes(".jpg") ||
            record.signatureUrl.includes(".jpeg")
          ) {
            extension = "jpeg";
          }

          const imageId = workbook.addImage({
            buffer: arrayBuffer,
            extension: extension,
          });

          // 设置行高以适应图片
          mainRow.height = 60;

          worksheet.addImage(imageId, {
            tl: { col: 7, row: currentRow - 1 }, // 签名列（第8列，索引7）
            ext: { width: 120, height: 50 },
          });
        } catch (err) {
          console.error("加载签名图片失败:", record.signatureUrl, err);
          mainRow.getCell("signature").value = "图片加载失败";
        }
      } else {
        mainRow.getCell("signature").value = "无";
      }

      currentRow++;

      // 如果有多套房产，也添加到表格中
      if (record.properties && record.properties.length > 0) {
        for (let j = 0; j < record.properties.length; j++) {
          const prop = record.properties[j];
          const propRow = worksheet.addRow({
            name: record.ownerName || "-",
            phone: record.ownerPhone || "-",
            district: prop.district || "-",
            building: prop.building || "-",
            unit: prop.unit || "-",
            room: prop.room || "-",
            area: prop.area || 0,
            signature: "", // 图片占位
            option: record.optionText || "-",
            time: formatTime(record.createdAt),
            type: `其他房产${j + 1}`,
          });

          // 设置数据行居中对齐
          propRow.alignment = { vertical: "middle", horizontal: "center" };

          // 其他房产使用相同的签名
          if (record.signatureUrl) {
            try {
              // 通过后端代理获取图片，避免CORS问题
              const response = await request.get("/votes/proxy-image", {
                params: { url: record.signatureUrl },
                responseType: "arraybuffer",
              });

              const arrayBuffer = response;

              // 根据URL判断图片类型
              let extension = "png";
              if (
                record.signatureUrl.includes(".jpg") ||
                record.signatureUrl.includes(".jpeg")
              ) {
                extension = "jpeg";
              }

              const imageId = workbook.addImage({
                buffer: arrayBuffer,
                extension: extension,
              });

              propRow.height = 60;

              worksheet.addImage(imageId, {
                tl: { col: 7, row: currentRow - 1 },
                ext: { width: 120, height: 50 },
              });
            } catch (err) {
              console.error("加载签名图片失败:", record.signatureUrl, err);
              propRow.getCell("signature").value = "图片加载失败";
            }
          } else {
            propRow.getCell("signature").value = "无";
          }

          currentRow++;
        }
      }

      // 更新进度 (20% - 85%)
      if ((i + 1) % 10 === 0 || i === totalRecords - 1) {
        exportProgress.value = 20 + Math.floor(((i + 1) / totalRecords) * 65);
        // 让UI有时间更新
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    exportProgress.value = 90;

    // 导出文件
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `投票详情_${voteTitle.value}_${
      new Date().toISOString().split("T")[0]
    }.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);

    exportProgress.value = 100;

    ElMessage.success(`成功导出 ${totalRecords} 条记录（含签名图片）`);
  } catch (err) {
    console.error("导出失败:", err);
    ElMessage.error("导出失败，请重试");
  } finally {
    setTimeout(() => {
      exporting.value = false;
      exportProgress.value = 0;
    }, 500);
  }
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
