<template>
  <div class="house-config-page">
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>房屋配置</span>
          <el-button type="primary" @click="saveConfig">保存配置</el-button>
        </div>
      </template>

      <div class="scrollable-content">
        <el-alert
          title="配置说明"
          type="info"
          :closable="false"
          style="margin-bottom: 20px"
        >
          请配置小区的房屋结构信息，业主提交审核时将根据此配置选择房号
        </el-alert>

        <el-form :model="configForm" label-width="120px" class="config-form">
          <el-form-item label="楼栋配置">
            <div class="building-config">
              <el-input-number
                v-model="configForm.buildingCount"
                :min="1"
                :max="100"
                placeholder="楼栋数量"
              />
              <span class="tip">栋</span>
              <el-button
                type="primary"
                size="small"
                @click="generateBuildings"
                style="margin-left: 10px"
              >
                生成楼栋
              </el-button>
            </div>
          </el-form-item>

          <el-divider />

          <div v-if="configForm.buildings.length > 0" class="buildings-list">
            <h3>楼栋详细配置</h3>
            <el-collapse accordion>
              <el-collapse-item
                v-for="(building, bIndex) in configForm.buildings"
                :key="bIndex"
                :name="bIndex"
              >
                <template #title>
                  <span class="building-title">
                    第 {{ building.name }}
                    <el-tag size="small" style="margin-left: 10px">
                      {{ building.units.length }} 个单元
                    </el-tag>
                  </span>
                </template>

                <div class="building-detail">
                  <el-form-item label="楼栋名称">
                    <el-input
                      v-model="building.name"
                      placeholder="例如：1"
                      style="width: 200px"
                    />
                  </el-form-item>

                  <el-form-item label="单元数量">
                    <el-input-number
                      v-model="building.unitCount"
                      :min="1"
                      :max="20"
                      @change="updateBuildingUnits(bIndex)"
                    />
                    <span class="tip">个</span>
                    <el-button
                      type="primary"
                      size="small"
                      @click="updateBuildingUnits(bIndex)"
                      style="margin-left: 10px"
                    >
                      应用
                    </el-button>
                  </el-form-item>

                  <el-divider />

                  <div v-if="building.units.length > 0" class="units-list">
                    <h4>单元配置</h4>
                    <el-row :gutter="20">
                      <el-col
                        v-for="(unit, uIndex) in building.units"
                        :key="uIndex"
                        :span="12"
                      >
                        <el-card class="unit-card" shadow="hover">
                          <template #header>
                            <span>第 {{ unit.name }} </span>
                          </template>
                          <el-form-item label="单元名称" label-width="80px">
                            <el-input
                              v-model="unit.name"
                              placeholder="例如：1"
                              size="small"
                            />
                          </el-form-item>
                          <el-form-item label="房号列表" label-width="80px">
                            <el-input
                              v-model="unit.rooms"
                              type="textarea"
                              :rows="3"
                              placeholder="每行一个房号，例如：&#10;101&#10;102&#10;201&#10;202"
                              size="small"
                            />
                          </el-form-item>
                          <div class="room-preview">
                            <el-tag
                              v-for="room in parseRooms(unit.rooms)"
                              :key="room"
                              size="small"
                              style="margin: 2px"
                            >
                              {{ room }}
                            </el-tag>
                          </div>
                        </el-card>
                      </el-col>
                    </el-row>
                  </div>

                  <el-divider />

                  <div class="template-actions">
                    <el-button
                      type="success"
                      size="small"
                      @click="saveAsTemplate(bIndex)"
                    >
                      保存为模版
                    </el-button>
                    <el-button
                      type="primary"
                      size="small"
                      @click="applyTemplate(bIndex)"
                    >
                      应用模版
                    </el-button>
                  </div>
                </div>
              </el-collapse-item>
            </el-collapse>
          </div>
        </el-form>
      </div>
    </el-card>

    <!-- 应用模版对话框 -->
    <el-dialog v-model="templateDialog" title="选择模版" width="500px">
      <el-alert
        v-if="templates.length === 0"
        title="暂无模版"
        type="info"
        :closable="false"
        style="margin-bottom: 20px"
      >
        请先在楼栋配置中"保存为模版"
      </el-alert>
      <div class="template-list" v-if="templates.length > 0">
        <el-radio-group v-model="selectedTemplate">
          <div
            v-for="(template, index) in templates"
            :key="index"
            class="template-radio-wrapper"
          >
            <el-radio :label="index" class="template-radio">
              <div class="template-item">
                <div class="template-header">
                  <span class="template-name">
                    {{ template.templateName || `模版 ${index + 1}` }}
                  </span>
                  <el-icon
                    class="edit-icon"
                    @click.stop="editTemplateName(index)"
                    title="编辑名称"
                  >
                    <Edit />
                  </el-icon>
                </div>
                <div class="template-info">
                  {{ template.unitCount }} 个单元， 共
                  {{ getTotalRooms(template) }} 个房间
                </div>
              </div>
            </el-radio>
            <el-icon
              class="delete-icon"
              @click.stop="deleteTemplate(index)"
              title="删除模版"
            >
              <Delete />
            </el-icon>
          </div>
        </el-radio-group>
      </div>
      <template #footer>
        <el-button @click="templateDialog = false">取消</el-button>
        <el-button
          type="danger"
          @click="clearTemplates"
          v-if="templates.length > 0"
        >
          清空模版
        </el-button>
        <el-button
          type="primary"
          @click="confirmApplyTemplate"
          :disabled="selectedTemplate === null || templates.length === 0"
        >
          应用
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Edit, Delete } from "@element-plus/icons-vue";
import request from "@/utils/axios";

interface Unit {
  name: string;
  rooms: string;
}

interface Building {
  name: string;
  unitCount: number;
  units: Unit[];
  templateName?: string;
}

interface ConfigForm {
  buildingCount: number;
  buildings: Building[];
}

const configForm = reactive<ConfigForm>({
  buildingCount: 0,
  buildings: [],
});

// 模版相关
const templates = ref<Building[]>([]);
const templateDialog = ref(false);
const selectedTemplate = ref<number | null>(null);
let currentBuildingIndex = -1;

function generateBuildings() {
  const count = configForm.buildingCount;
  const buildings: Building[] = [];

  for (let i = 1; i <= count; i++) {
    buildings.push({
      name: String(i),
      unitCount: 1,
      units: [
        {
          name: "1",
          rooms: "101\n201\n301\n401\n501\n601",
        },
      ],
    });
  }

  configForm.buildings = buildings;
  ElMessage.success(`已生成 ${count} 栋楼的初始配置`);
}

function updateBuildingUnits(buildingIndex: number) {
  const building = configForm.buildings[buildingIndex];
  const count = building.unitCount;
  const units: Unit[] = [];

  for (let i = 1; i <= count; i++) {
    const existingUnit = building.units.find((u) => u.name === String(i));
    units.push(
      existingUnit || {
        name: String(i),
        rooms: "101\n201\n301\n401\n501\n601",
      }
    );
  }

  building.units = units;
  ElMessage.success(`已更新第 ${building.name} 栋的单元配置`);
}

function parseRooms(roomsText: string): string[] {
  if (!roomsText) return [];
  return roomsText
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r);
}

// 保存为模版
async function saveAsTemplate(buildingIndex: number) {
  const building = configForm.buildings[buildingIndex];
  if (!building || building.units.length === 0) {
    ElMessage.warning("请先配置单元信息");
    return;
  }

  // 询问模版名称
  try {
    const { value: templateName } = await ElMessageBox.prompt(
      "请输入模版名称",
      "保存为模版",
      {
        confirmButtonText: "保存",
        cancelButtonText: "取消",
        inputPattern: /.+/,
        inputErrorMessage: "模版名称不能为空",
        inputValue: `模版 ${templates.value.length + 1}`,
      }
    );

    // 深拷贝楼栋配置（不包括楼栋名称）
    const template: Building = {
      name: "",
      templateName: templateName || `模版 ${templates.value.length + 1}`,
      unitCount: building.unitCount,
      units: building.units.map((u) => ({
        name: u.name,
        rooms: u.rooms,
      })),
    };

    templates.value.push(template);
    localStorage.setItem("building-templates", JSON.stringify(templates.value));
    ElMessage.success(`已保存模版"${template.templateName}"`);
  } catch (err) {
    // 用户取消
  }
}

// 应用模版
function applyTemplate(buildingIndex: number) {
  if (templates.value.length === 0) {
    ElMessage.warning("暂无可用模版，请先保存模版");
    return;
  }
  currentBuildingIndex = buildingIndex;
  selectedTemplate.value = null;
  templateDialog.value = true;
}

// 确认应用模版
function confirmApplyTemplate() {
  if (selectedTemplate.value === null) return;

  const template = templates.value[selectedTemplate.value];
  const building = configForm.buildings[currentBuildingIndex];

  if (!building) return;

  // 应用模版（保留楼栋名称）
  building.unitCount = template.unitCount;
  building.units = template.units.map((u) => ({
    name: u.name,
    rooms: u.rooms,
  }));

  templateDialog.value = false;
  ElMessage.success(`已应用模版到第 ${building.name} 栋`);
}

// 清空所有模版
function clearTemplates() {
  templates.value = [];
  localStorage.removeItem("building-templates");
  ElMessage.success("已清空所有模版");
  templateDialog.value = false;
}

// 计算模版总房间数
function getTotalRooms(template: Building): number {
  return template.units.reduce((total, unit) => {
    return total + parseRooms(unit.rooms).length;
  }, 0);
}

// 编辑模版名称
async function editTemplateName(index: number) {
  const template = templates.value[index];
  try {
    const { value: newName } = await ElMessageBox.prompt(
      "请输入新的模版名称",
      "编辑模版名称",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        inputPattern: /.+/,
        inputErrorMessage: "模版名称不能为空",
        inputValue: template.templateName || `模版 ${index + 1}`,
      }
    );

    template.templateName = newName;
    localStorage.setItem("building-templates", JSON.stringify(templates.value));
    ElMessage.success("模版名称已更新");
  } catch (err) {
    // 用户取消
  }
}

// 删除单个模版
async function deleteTemplate(index: number) {
  const template = templates.value[index];
  try {
    await ElMessageBox.confirm(
      `确定要删除模版"${template.templateName || `模版 ${index + 1}`}"吗？`,
      "删除模版",
      {
        confirmButtonText: "删除",
        cancelButtonText: "取消",
        type: "warning",
      }
    );

    templates.value.splice(index, 1);
    localStorage.setItem("building-templates", JSON.stringify(templates.value));

    // 如果删除的是当前选中的模版，清空选择
    if (selectedTemplate.value === index) {
      selectedTemplate.value = null;
    } else if (
      selectedTemplate.value !== null &&
      selectedTemplate.value > index
    ) {
      selectedTemplate.value--;
    }

    ElMessage.success("模版已删除");
  } catch (err) {
    // 用户取消
  }
}

async function saveConfig() {
  try {
    // 转换为后端需要的格式
    const config = {
      buildings: configForm.buildings.map((b) => ({
        name: b.name,
        units: b.units.map((u) => ({
          name: u.name,
          rooms: parseRooms(u.rooms),
        })),
      })),
    };

    await request.post("/house-config", config);
    ElMessage.success("保存成功");
    loadConfig();
  } catch (err) {
    console.error("保存配置失败:", err);
    ElMessage.error("保存失败");
  }
}

async function loadConfig() {
  try {
    const data = await request.get("/house-config");
    if (data.config) {
      const config = data.config;
      configForm.buildingCount = config.buildings?.length || 0;
      configForm.buildings =
        config.buildings?.map((b: any) => ({
          name: b.name,
          unitCount: b.units?.length || 0,
          units:
            b.units?.map((u: any) => ({
              name: u.name,
              rooms: (u.rooms || []).join("\n"),
            })) || [],
        })) || [];
    }
  } catch (err) {
    console.error("加载配置失败:", err);
  }
}

onMounted(() => {
  loadConfig();
  // 加载保存的模版
  const savedTemplates = localStorage.getItem("building-templates");
  if (savedTemplates) {
    try {
      templates.value = JSON.parse(savedTemplates);
    } catch (e) {
      console.error("加载模版失败:", e);
    }
  }
});
</script>

<style scoped>
.house-config-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.config-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.config-card :deep(.el-card__body) {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.scrollable-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 10px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.config-form {
  margin-top: 20px;
}

.building-config {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tip {
  color: #909399;
  margin-left: 8px;
}

.buildings-list {
  margin-top: 20px;
}

.building-title {
  font-weight: 600;
  font-size: 15px;
}

.building-detail {
  padding: 20px;
}

.units-list {
  margin-top: 20px;
}

.unit-card {
  margin-bottom: 15px;
}

.room-preview {
  margin-top: 10px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
  min-height: 40px;
}

.template-actions {
  margin-top: 20px;
  display: flex;
  gap: 10px;
}

.template-list {
  max-height: 400px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.template-list :deep(.el-radio-group) {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.template-radio-wrapper {
  display: flex;
  align-items: center;
  width: 90%;
  margin-bottom: 15px;
  gap: 10px;
}

.template-radio {
  flex: 1;
  display: flex !important;
  align-items: flex-start !important;
  margin: 0 !important;
  padding: 12px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  transition: all 0.3s;
}

.template-radio:hover {
  border-color: #409eff;
  background-color: #f5f7fa;
}

.template-radio :deep(.el-radio__input) {
  margin-top: 2px;
}

.template-item {
  margin-left: 8px;
  flex: 1;
}

.template-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.template-name {
  font-weight: 600;
  font-size: 14px;
}

.edit-icon {
  font-size: 14px;
  color: #409eff;
  cursor: pointer;
  transition: transform 0.2s;
}

.edit-icon:hover {
  transform: scale(1.2);
}

.delete-icon {
  font-size: 18px;
  color: #f56c6c;
  cursor: pointer;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.delete-icon:hover {
  transform: scale(1.2);
}

.template-info {
  font-size: 12px;
  color: #909399;
}
</style>
