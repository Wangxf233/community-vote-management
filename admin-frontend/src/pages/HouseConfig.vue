<template>
  <div class="house-config-page">
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <el-radio-group v-model="configType" size="large">
            <el-radio-button label="house">房屋配置</el-radio-button>
            <el-radio-button label="shop">商铺配置</el-radio-button>
          </el-radio-group>
        </div>
      </template>

      <div class="scrollable-content">
        <!-- 房屋配置：原有逻辑、页面完全保留，不做任何改动 -->
        <div v-if="configType === 'house'">
          <el-alert title="配置说明" type="info" :closable="false" style="margin-bottom: 20px">
            <span v-if="configType === 'house'">请配置小区的房屋结构信息，业主提交审核时将根据此配置选择房号</span>
            <span v-else
              >请配置小区的商铺信息，业主提交审核时将根据此配置选择门牌号。备注：若商铺无期/区号、栋号、单元号，则留空</span
            >
          </el-alert>

          <el-form :model="configForm" label-width="120px" class="config-form">
            <!-- 配置楼栋按钮 -->
            <div class="config-button-wrapper">
              <el-button type="primary" @click="showBuildingConfig = !showBuildingConfig">
                {{ showBuildingConfig ? "收起配置" : "配置楼栋" }}
              </el-button>
            </div>

            <!-- 楼栋配置区域 -->
            <div v-if="showBuildingConfig" class="building-setup-area">
              <el-form-item label="小区期/区号">
                <el-input v-model="configForm.district" placeholder="例如：1" style="width: 200px" />
                <span class="tip" style="margin-left: 8px">若小区只有1期/区，填1即可</span>
              </el-form-item>

              <el-form-item label="楼栋配置">
                <div class="building-config">
                  <el-input-number v-model="configForm.buildingCount" :min="1" :max="100" placeholder="楼栋数量" />
                  <span class="tip">栋</span>
                  <el-button type="primary" size="small" style="margin-left: 10px" @click="generateBuildings">
                    生成楼栋
                  </el-button>
                </div>
              </el-form-item>
            </div>

            <el-divider v-if="configForm.buildings.length > 0" />

            <!-- 楼栋列表 -->
            <div v-if="configForm.buildings.length > 0" class="buildings-list">
              <div class="buildings-grid">
                <div
                  v-for="(building, bIndex) in configForm.buildings"
                  :key="`building-${configType}-${bIndex}`"
                  class="building-item"
                  :class="{ active: expandedBuilding === bIndex }"
                  @click="toggleBuilding(bIndex)"
                >
                  <div class="building-number">{{ bIndex + 1 }}</div>
                  <div class="building-name">{{ building.name }}栋</div>
                </div>
              </div>

              <!-- 选中楼栋的配置区域 -->
              <div v-if="expandedBuilding !== null" class="building-config-area">
                <div class="config-header">
                  <div class="header-left">
                    <h4>{{ configForm.buildings[expandedBuilding].name }}栋 配置</h4>
                    <el-button type="primary" size="small" @click="showUnitConfig = !showUnitConfig">
                      {{ showUnitConfig ? "收起配置" : "配置单元" }}
                    </el-button>
                  </div>
                  <el-button size="small" @click="expandedBuilding = null"> 收起 </el-button>
                </div>

                <div class="building-detail">
                  <!-- 单元配置区域 -->
                  <div v-if="showUnitConfig" class="unit-setup-area">
                    <el-form-item label="楼栋名称">
                      <el-input
                        v-model="configForm.buildings[expandedBuilding].name"
                        placeholder="例如：1"
                        style="width: 200px"
                      />
                    </el-form-item>

                    <el-form-item label="单元数量">
                      <el-input-number
                        v-model="configForm.buildings[expandedBuilding].unitCount"
                        :min="1"
                        :max="20"
                        @change="updateBuildingUnits(expandedBuilding)"
                      />
                      <span class="tip">个</span>
                      <el-button
                        type="primary"
                        size="small"
                        style="margin-left: 10px"
                        @click="updateBuildingUnits(expandedBuilding)"
                      >
                        应用
                      </el-button>
                    </el-form-item>
                  </div>

                  <el-divider v-if="configForm.buildings[expandedBuilding].units.length > 0" />

                  <!-- 单元列表 -->
                  <div v-if="configForm.buildings[expandedBuilding].units.length > 0" class="units-list">
                    <div class="config-header">
                      <div class="header-left">
                        <h4>单元配置</h4>
                        <el-button
                          type="primary"
                          size="small"
                          :disabled="expandedUnit === null"
                          @click="showRoomConfig = !showRoomConfig"
                        >
                          {{ showRoomConfig ? "收起配置" : "配置房号" }}
                        </el-button>
                      </div>
                    </div>

                    <!-- 单元网格展示 -->
                    <div class="units-grid">
                      <div
                        v-for="(unit, uIndex) in configForm.buildings[expandedBuilding].units"
                        :key="uIndex"
                        class="unit-item"
                        :class="{ active: expandedUnit === uIndex }"
                        @click="toggleUnit(uIndex)"
                      >
                        <div class="unit-name">{{ unit.name }}单元</div>
                        <div v-if="unit.rooms" class="unit-info">{{ unit.rooms.length }}个房间</div>
                      </div>
                    </div>

                    <!-- 展开的单元配置 -->
                    <div v-if="expandedUnit !== null" class="unit-config-area">
                      <!-- 配置表单（只有点击配置房号按钮才显示） -->
                      <div v-if="showRoomConfig">
                        <el-form-item label="单元名称" label-width="100px">
                          <el-input
                            v-model="configForm.buildings[expandedBuilding].units[expandedUnit].name"
                            placeholder="例如：1"
                            size="small"
                            style="width: 150px"
                          />
                        </el-form-item>

                        <el-divider content-position="left">房号生成规则</el-divider>

                        <el-form-item label="起始层数" label-width="100px">
                          <el-input-number
                            v-model="configForm.buildings[expandedBuilding].units[expandedUnit].startFloor"
                            :min="1"
                            :max="100"
                            :precision="0"
                            :step="1"
                            size="small"
                            style="width: 150px"
                            @change="clearRoomPreview(configForm.buildings[expandedBuilding].units[expandedUnit])"
                          />
                          <span class="tip" style="margin-left: 8px">房号从该楼层开始生成</span>
                        </el-form-item>

                        <el-form-item label="层数" label-width="100px">
                          <el-input-number
                            v-model="configForm.buildings[expandedBuilding].units[expandedUnit].floors"
                            :min="1"
                            :max="100"
                            size="small"
                            style="width: 150px"
                            @change="clearRoomPreview(configForm.buildings[expandedBuilding].units[expandedUnit])"
                          />
                        </el-form-item>

                        <el-form-item label="一层几户" label-width="100px">
                          <el-input-number
                            v-model="configForm.buildings[expandedBuilding].units[expandedUnit].roomsPerFloor"
                            :min="1"
                            :max="20"
                            size="small"
                            style="width: 150px"
                            @change="clearRoomPreview(configForm.buildings[expandedBuilding].units[expandedUnit])"
                          />
                        </el-form-item>

                        <el-form-item :label="configType === 'house' ? '起始户号' : '起始门牌号'" label-width="100px">
                          <el-input
                            v-model="configForm.buildings[expandedBuilding].units[expandedUnit].startRoom"
                            placeholder="例如：0101"
                            size="small"
                            style="width: 150px"
                            maxlength="4"
                            @input="
                              ((configForm.buildings[expandedBuilding].units[expandedUnit].startRoom =
                                configForm.buildings[expandedBuilding].units[expandedUnit].startRoom.replace(
                                  /\D/g,
                                  '',
                                )),
                              clearRoomPreview(configForm.buildings[expandedBuilding].units[expandedUnit]))
                            "
                          />
                          <span class="tip" style="margin-left: 8px">四位数字，例如：0101</span>
                        </el-form-item>

                        <el-form-item :label="configType === 'house' ? '结束户号' : '结束门牌号'" label-width="100px">
                          <el-input
                            v-model="configForm.buildings[expandedBuilding].units[expandedUnit].endRoom"
                            placeholder="例如：0606"
                            size="small"
                            style="width: 150px"
                            maxlength="4"
                            @input="
                              ((configForm.buildings[expandedBuilding].units[expandedUnit].endRoom =
                                configForm.buildings[expandedBuilding].units[expandedUnit].endRoom.replace(/\D/g, '')),
                              clearRoomPreview(configForm.buildings[expandedBuilding].units[expandedUnit]))
                            "
                          />
                          <span class="tip" style="margin-left: 8px">四位数字，例如：0606</span>
                        </el-form-item>

                        <el-button
                          type="primary"
                          size="small"
                          style="margin-bottom: 10px"
                          @click="
                            previewRooms(
                              configForm.buildings[expandedBuilding].units[expandedUnit],
                              expandedBuilding,
                              expandedUnit,
                            )
                          "
                        >
                          生成预览
                        </el-button>
                      </div>

                      <!-- 房号列表（始终显示） -->
                      <div
                        v-if="
                          expandedBuilding !== null &&
                          expandedUnit !== null &&
                          configForm.buildings[expandedBuilding]?.units[expandedUnit]?.rooms &&
                          configForm.buildings[expandedBuilding].units[expandedUnit].rooms!.length > 0
                        "
                        class="room-preview"
                      >
                        <div class="preview-title">
                          生成的{{ configType === "house" ? "房号" : "门牌号" }}（共
                          {{ configForm.buildings[expandedBuilding!].units[expandedUnit!].rooms!.length }}
                          个）
                          <span class="edit-hint">双击房号可修改</span>
                        </div>
                        <div class="room-table-wrapper">
                          <div class="room-table-container">
                            <table class="room-table">
                              <thead>
                                <tr>
                                  <th class="floor-header diagonal-header">
                                    <span class="diagonal-text-bottom">楼层</span>
                                    <span class="diagonal-text-top">户号</span>
                                  </th>
                                  <th
                                    v-for="houseNum in configForm.buildings[expandedBuilding].units[expandedUnit]
                                      .generatedHouses"
                                    :key="houseNum"
                                    class="house-header"
                                  >
                                    {{ houseNum }}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr
                                  v-for="(row, rowIdx) in configForm.buildings[expandedBuilding].units[expandedUnit]
                                    .generatedRows"
                                  :key="
                                    configForm.buildings[expandedBuilding].units[expandedUnit].generatedFloors![rowIdx]
                                  "
                                >
                                  <td class="floor-cell">
                                    {{
                                      configForm.buildings[expandedBuilding].units[expandedUnit].generatedFloors![
                                        rowIdx
                                      ]
                                    }}
                                  </td>
                                  <td
                                    v-for="(room, cellIdx) in row"
                                    :key="
                                      configForm.buildings[expandedBuilding].units[expandedUnit].generatedHouses![
                                        cellIdx
                                      ]
                                    "
                                    class="room-cell"
                                  >
                                    <el-input
                                      v-if="editingRoom === `${expandedBuilding}-${expandedUnit}-${rowIdx}-${cellIdx}`"
                                      v-model="
                                        configForm.buildings[expandedBuilding!].units[expandedUnit!].generatedRows![
                                          rowIdx
                                        ][cellIdx]
                                      "
                                      size="small"
                                      maxlength="10"
                                      style="width: 100%"
                                      @blur="
                                        ((editingRoom = null),
                                        syncRoomsFromSnapshot(
                                          configForm.buildings[expandedBuilding].units[expandedUnit],
                                        ))
                                      "
                                      @keyup.enter="
                                        ((editingRoom = null),
                                        syncRoomsFromSnapshot(
                                          configForm.buildings[expandedBuilding].units[expandedUnit],
                                        ))
                                      "
                                    />
                                    <span
                                      v-else
                                      class="room-number"
                                      @dblclick="
                                        editingRoom = `${expandedBuilding}-${expandedUnit}-${rowIdx}-${cellIdx}`
                                      "
                                    >
                                      {{ room }}
                                    </span>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <el-button
                            class="reverse-btn"
                            size="small"
                            type="primary"
                            plain
                            @click="toggleHouseNumOrder(expandedBuilding, expandedUnit)"
                          >
                            户号逆序
                          </el-button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <el-divider />

                  <div class="template-actions">
                    <el-button type="success" size="small" @click="saveAsTemplate(expandedBuilding)">
                      保存为楼栋模版
                    </el-button>
                    <el-button type="primary" size="small" @click="applyTemplate(expandedBuilding)">
                      应用楼栋模版
                    </el-button>
                    <el-button
                      type="success"
                      size="small"
                      plain
                      :disabled="expandedUnit === null"
                      @click="saveUnitAsTemplate(expandedBuilding)"
                    >
                      保存为单元模版
                    </el-button>
                    <el-button
                      type="primary"
                      size="small"
                      plain
                      :disabled="expandedUnit === null"
                      @click="applyUnitTemplate(expandedBuilding)"
                    >
                      应用单元模版
                    </el-button>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="configForm.buildings.length > 0" class="save-button-wrapper">
              <el-button type="primary" size="large" style="width: 100%" @click="saveConfig"> 保存配置 </el-button>
            </div>
          </el-form>
        </div>

        <!-- 商铺配置 Tab：独立业务，门牌号与商铺名一一对应，均为选填，全部手动录入，无自动生成规则 -->
        <div v-else class="shop-config-content">
          <el-alert title="配置说明" type="info" :closable="false" style="margin-bottom: 20px">
            <span
              >请配置小区的商铺信息，每行一个商铺，门牌号与商铺名一一对应。业主选择商铺角色注册时将根据此配置选择。两项均为选填，未配置时小程序端对应下拉框将不可用</span
            >
          </el-alert>

          <el-form label-width="0" class="config-form">
            <!-- 商铺成对列表：一行 = 一个商铺（门牌号 + 商铺名） -->
            <div class="shop-list">
              <div class="shop-list-header">
                <span class="shop-row-label">序号</span>
                <span class="shop-col-label">门牌号</span>
                <span class="shop-col-label">商铺名</span>
                <span class="shop-col-action"></span>
              </div>
              <div v-for="(shop, index) in shopForm.shops" :key="`shop-row-${index}`" class="shop-list-row">
                <span class="shop-row-label">{{ index + 1 }}</span>
                <el-input v-model="shop.houseNumber" placeholder="选填，例如：12号" class="shop-col-input" />
                <el-input v-model="shop.shopName" placeholder="选填，例如：张记便利店" class="shop-col-input" />
                <el-button
                  type="danger"
                  text
                  :disabled="shopForm.shops.length <= 1"
                  class="shop-col-action"
                  @click="removeShopRow(index)"
                >
                  删除
                </el-button>
              </div>
              <el-button type="primary" plain @click="addShopRow"> + 添加一行 </el-button>
            </div>

            <div class="save-button-wrapper">
              <el-button type="primary" size="large" style="width: 100%" @click="saveShopConfig"> 保存配置 </el-button>
            </div>
          </el-form>
        </div>
      </div>
    </el-card>

    <!-- 应用单元模版对话框 -->
    <Teleport to="body">
      <el-dialog v-model="unitTemplateDialog" title="选择单元模版" width="500px">
        <el-alert
          v-if="unitTemplates.length === 0"
          title="暂无模版"
          type="info"
          :closable="false"
          style="margin-bottom: 20px"
        >
          请先在单元配置中"保存为单元模版"
        </el-alert>
        <div v-if="unitTemplates.length > 0" class="template-list">
          <el-radio-group v-model="selectedUnitTemplate">
            <div v-for="(template, index) in unitTemplates" :key="index" class="template-radio-wrapper">
              <el-radio :label="index" class="template-radio">
                <div class="template-item">
                  <div class="template-header">
                    <span class="template-name">
                      {{ template.templateName || `单元模版 ${index + 1}` }}
                    </span>
                    <el-icon class="edit-icon" title="编辑名称" @click.stop="editUnitTemplateName(index)">
                      <Edit />
                    </el-icon>
                  </div>
                  <div class="template-info">
                    起始层数 {{ template.startFloor || 1 }}，共 {{ template.floors }} 层，一层
                    {{ template.roomsPerFloor }} 户
                  </div>
                </div>
              </el-radio>
              <el-icon class="delete-icon" title="删除模版" @click.stop="deleteUnitTemplate(index)">
                <Delete />
              </el-icon>
            </div>
          </el-radio-group>
        </div>
        <template #footer>
          <el-button @click="unitTemplateDialog = false">取消</el-button>
          <el-button
            type="primary"
            :disabled="selectedUnitTemplate === null || unitTemplates.length === 0"
            @click="confirmApplyUnitTemplate"
          >
            应用
          </el-button>
        </template>
      </el-dialog>
    </Teleport>

    <!-- 应用模版对话框 -->
    <Teleport to="body">
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
        <div v-if="templates.length > 0" class="template-list">
          <el-radio-group v-model="selectedTemplate">
            <div v-for="(template, index) in templates" :key="index" class="template-radio-wrapper">
              <el-radio :label="index" class="template-radio">
                <div class="template-item">
                  <div class="template-header">
                    <span class="template-name">
                      {{ template.templateName || `模版 ${index + 1}` }}
                    </span>
                    <el-icon class="edit-icon" title="编辑名称" @click.stop="editTemplateName(index)">
                      <Edit />
                    </el-icon>
                  </div>
                  <div class="template-info">
                    {{ template.unitCount }} 个单元， 共 {{ getTotalRooms(template) }} 个房间
                  </div>
                </div>
              </el-radio>
              <el-icon class="delete-icon" title="删除模版" @click.stop="deleteTemplate(index)">
                <Delete />
              </el-icon>
            </div>
          </el-radio-group>
        </div>
        <template #footer>
          <el-button @click="templateDialog = false">取消</el-button>
          <el-button v-if="templates.length > 0" type="danger" @click="clearTemplates"> 清空模版 </el-button>
          <el-button
            type="primary"
            :disabled="selectedTemplate === null || templates.length === 0"
            @click="confirmApplyTemplate"
          >
            应用
          </el-button>
        </template>
      </el-dialog>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Edit, Delete } from "@element-plus/icons-vue";
import request from "@/utils/axios";

interface Unit {
  name: string;
  startFloor?: number; // 起始层数（整数，房号从该楼层开始生成，默认1）
  floors: number; // 层数
  roomsPerFloor: number; // 一层几户
  startRoom: string; // 起始房号（4位数字符串）
  endRoom: string; // 结束房号（4位数字符串）
  rooms?: string[]; // 生成的房号列表
  generatedFloors?: number[]; // 生成预览时的楼层快照（从高到低）
  generatedHouses?: number[]; // 生成预览时的户号快照
  generatedRows?: string[][]; // 生成预览时的房号二维快照
  templateName?: string; // 单元模版名称（仅模版记录使用）
}

interface Building {
  name: string;
  unitCount: number;
  units: Unit[];
  templateName?: string;
}

interface ConfigForm {
  buildingCount: number;
  district: string; // 小区期/区号
  buildings: Building[];
}

const configType = ref<"house" | "shop">("house"); // 配置类型：房屋或商铺

const configForm = reactive<ConfigForm>({
  buildingCount: 0,
  district: "1",
  buildings: [],
});

// 商铺配置（独立业务：门牌号与商铺名一一对应，一行一个商铺，两项均选填，纯手动录入，无自动生成规则）
const shopForm = reactive({
  shops: [{ houseNumber: "", shopName: "" }] as {
    houseNumber: string;
    shopName: string;
  }[],
});

function addShopRow() {
  shopForm.shops.push({ houseNumber: "", shopName: "" });
}

function removeShopRow(index: number) {
  shopForm.shops.splice(index, 1);
}

// 加载商铺配置（与房屋配置完全独立，存 shop_config 集合）
async function loadShopConfig() {
  try {
    const data: any = await request.get("/shop-config");
    if (data.config && Array.isArray(data.config.shops)) {
      shopForm.shops =
        data.config.shops.length > 0
          ? data.config.shops.map((s: any) => ({
              houseNumber: s.houseNumber || "",
              shopName: s.shopName || "",
            }))
          : [{ houseNumber: "", shopName: "" }];
    }
  } catch (err) {
    console.error("加载商铺配置失败:", err);
  }
}

// 保存商铺配置
async function saveShopConfig() {
  try {
    await request.post("/shop-config", {
      shops: shopForm.shops,
    });
    ElMessage.success("商铺配置保存成功");
    loadShopConfig();
  } catch (err) {
    console.error("保存商铺配置失败:", err);
    ElMessage.error("保存失败");
  }
}

// 模版相关
const templates = ref<Building[]>([]);
const templateDialog = ref(false);
const selectedTemplate = ref<number | null>(null);

// 单元模版相关
const unitTemplates = ref<Unit[]>([]);
const unitTemplateDialog = ref(false);
const selectedUnitTemplate = ref<number | null>(null);
let currentUnitBuildingIndex = -1;
const editingRoom = ref<string | null>(null); // 当前正在编辑的房号，格式：buildingIndex-unitIndex-roomIndex
const reverseHouseNum = ref<{ [key: string]: boolean }>({}); // 记录每个单元的户号是否逆序，key格式：buildingIndex-unitIndex
let currentBuildingIndex = -1;

// 展开状态
const expandedBuilding = ref<number | null>(null); // 当前展开的楼栋索引
const expandedUnit = ref<number | null>(null); // 当前展开的单元索引

// 配置显示状态
const showBuildingConfig = ref(false); // 是否显示楼栋配置区域
const showUnitConfig = ref(false); // 是否显示单元配置区域
const showRoomConfig = ref(false); // 是否显示房号配置区域

// 切换楼栋展开状态
function toggleBuilding(index: number) {
  if (expandedBuilding.value === index) {
    expandedBuilding.value = null;
    expandedUnit.value = null;
    showUnitConfig.value = false;
    showRoomConfig.value = false;
  } else {
    expandedBuilding.value = index;
    expandedUnit.value = null; // 切换楼栋时收起单元
    showUnitConfig.value = false;
    showRoomConfig.value = false;
  }
}

// 切换单元展开状态
function toggleUnit(index: number) {
  if (expandedUnit.value === index) {
    expandedUnit.value = null;
    showRoomConfig.value = false;
  } else {
    expandedUnit.value = index;
    showRoomConfig.value = false; // 默认不展开房号配置
  }
}

// 格式化房号为4位数
function formatRoomNumber(room: string | number | undefined): string {
  if (!room && room !== 0) return "0001";
  const roomStr = String(room).replace(/\D/g, ""); // 只保留数字
  if (!roomStr) return "0001";
  return roomStr.padStart(4, "0");
}

// 格式化户号为2位数
function formatHouseNumber(num: string | number | undefined): string {
  if (!num && num !== 0) return "01";
  const numStr = String(num).replace(/\D/g, ""); // 只保留数字
  if (!numStr) return "01";
  return numStr.padStart(2, "0");
}

// 生成四位数房号
function generateRoomNumber(num: number): string {
  return num.toString().padStart(4, "0");
}

// 根据规则生成房号列表
function generateRoomsFromRule(unit: Unit): string[] {
  const rooms: string[] = [];
  const { floors, startRoom, endRoom } = unit;

  if (!floors || !startRoom || !endRoom) {
    return [];
  }

  // startRoom和endRoom是4位数格式，如"0101"表示1楼1号，"0604"表示6楼4号
  // 前两位是楼层，后两位是户号
  // 起始层数：优先使用显式配置的 startFloor（整数），未配置时回退为 startRoom 的楼层部分
  const parsedStartFloor = parseInt(startRoom.substring(0, 2), 10);
  const startFloor = unit.startFloor && unit.startFloor >= 1 ? Math.floor(unit.startFloor) : parsedStartFloor;
  const startHouse = parseInt(startRoom.substring(2, 4), 10);
  const endFloor = parseInt(endRoom.substring(0, 2), 10);
  const endHouse = parseInt(endRoom.substring(2, 4), 10);

  if (isNaN(startFloor) || isNaN(startHouse) || isNaN(endFloor) || isNaN(endHouse)) {
    return [];
  }

  // 遍历每层，从起始楼层开始，共 floors 层
  for (let floor = startFloor; floor < startFloor + floors; floor++) {
    for (let house = startHouse; house <= endHouse; house++) {
      // 格式：楼层(2位) + 户号(2位)
      const floorStr = floor.toString().padStart(2, "0");
      const houseStr = house.toString().padStart(2, "0");
      rooms.push(floorStr + houseStr);
    }
  }

  return rooms;
}

function generateBuildings() {
  const count = configForm.buildingCount;

  if (!count || count < 1) {
    ElMessage.warning("请先输入楼栋数量");
    return;
  }

  const buildings: Building[] = [];

  for (let i = 1; i <= count; i++) {
    buildings.push({
      name: String(i),
      unitCount: 1,
      units: [
        {
          name: "1",
          startFloor: 1,
          floors: 6,
          roomsPerFloor: 6,
          startRoom: "0101",
          endRoom: "0606",
          rooms: [],
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
        startFloor: 1,
        floors: 6,
        roomsPerFloor: 6,
        startRoom: "0101",
        endRoom: "0606",
        rooms: [],
      },
    );
  }

  building.units = units;
  ElMessage.success(`已更新第 ${building.name} 栋的单元配置`);
}

// 基于 unit.rooms 构建展示快照（不重新生成房号，保留手工修改的房号）
function buildRoomSnapshot(unit: Unit, bIndex?: number, uIndex?: number) {
  // 楼层快照（从起始层数开始，从高到低：顶层 = 起始层数 + 层数 - 1）
  const baseFloor =
    unit.startFloor && unit.startFloor >= 1
      ? Math.floor(unit.startFloor)
      : parseInt(unit.startRoom.substring(0, 2), 10) || 1;
  const floors: number[] = [];
  for (let i = 0; i < unit.floors; i++) {
    floors.push(baseFloor + unit.floors - 1 - i);
  }
  unit.generatedFloors = floors;

  // 户号快照（考虑逆序）
  const houses: number[] = [];
  const startHouse = parseInt(unit.startRoom.substring(2, 4), 10);
  const endHouse = parseInt(unit.endRoom.substring(2, 4), 10);
  for (let i = startHouse; i <= endHouse; i++) {
    houses.push(i);
  }
  if (bIndex !== undefined && uIndex !== undefined) {
    const key = `${bIndex}-${uIndex}`;
    if (reverseHouseNum.value[key]) houses.reverse();
  }
  unit.generatedHouses = houses;

  // 房号二维快照（每层一行）
  // rooms 按楼层从低到高存储，表格高层在上，需反转行序；户号按显示顺序（可能逆序）取对应房号
  const totalHouses = endHouse - startHouse + 1;
  const rows: string[][] = [];
  for (let f = 0; f < unit.floors; f++) {
    const roomFloor = unit.floors - 1 - f; // 显示行 f 对应 rooms 中的楼层索引
    const row: string[] = [];
    for (const h of houses) {
      const roomIdx = roomFloor * totalHouses + (h - startHouse);
      row.push((unit.rooms || [])[roomIdx] || "");
    }
    rows.push(row);
  }
  unit.generatedRows = rows;
}

// 预览生成的房号 — 生成一次性快照，表格只读快照，避免输入规则时实时重算卡顿
function previewRooms(unit: Unit, bIndex?: number, uIndex?: number) {
  unit.rooms = generateRoomsFromRule(unit);
  buildRoomSnapshot(unit, bIndex, uIndex);
}

// 规则变化时清空预览，强制重新点击「生成预览」
function clearRoomPreview(unit: Unit) {
  unit.rooms = [];
  unit.generatedFloors = [];
  unit.generatedHouses = [];
  unit.generatedRows = [];
}

// 把快照中的修改同步回 rooms（按楼层从低到高、户号升序存储）
function syncRoomsFromSnapshot(unit: Unit) {
  if (!unit.generatedRows || !unit.generatedHouses) return;
  const startHouse = parseInt(unit.startRoom.substring(2, 4), 10);
  const totalHouses = unit.generatedHouses.length;
  const newRooms: string[] = [];
  // 快照行0是最高层，rooms 要求低层在前
  for (let f = unit.generatedRows.length - 1; f >= 0; f--) {
    for (let h = startHouse; h < startHouse + totalHouses; h++) {
      const displayIdx = unit.generatedHouses.indexOf(h);
      newRooms.push(unit.generatedRows[f][displayIdx] || "");
    }
  }
  unit.rooms = newRooms;
}

// 切换户号逆序 — 切换后重新生成快照
function toggleHouseNumOrder(bIndex: number, uIndex: number) {
  const key = `${bIndex}-${uIndex}`;
  reverseHouseNum.value[key] = !reverseHouseNum.value[key];
  const unit = configForm.buildings[bIndex]?.units[uIndex];
  if (unit && unit.rooms && unit.rooms.length > 0) {
    previewRooms(unit, bIndex, uIndex);
  }
}

// 删除房号
function removeRoom(unit: Unit, roomIndex: number) {
  if (unit.rooms && unit.rooms.length > roomIndex) {
    unit.rooms.splice(roomIndex, 1);
  }
}

// 添加新房号
async function addNewRoom(unit: Unit) {
  try {
    const { value: newRoom } = await ElMessageBox.prompt(
      `请输入新的${configType.value === "house" ? "房号" : "门牌号"}`,
      `添加${configType.value === "house" ? "房号" : "门牌号"}`,
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        inputPattern: /^[a-zA-Z0-9]{1,10}$/,
        inputErrorMessage: "请输入1-10位字母或数字",
        inputValue: "",
      },
    );

    if (newRoom) {
      if (!unit.rooms) {
        unit.rooms = [];
      }
      // 检查是否已存在
      if (unit.rooms.includes(newRoom)) {
        ElMessage.warning("该房号已存在");
        return;
      }
      unit.rooms.push(newRoom);
      ElMessage.success("添加成功");
    }
  } catch (err) {
    // 用户取消
  }
}

function parseRooms(roomsArray?: string[]): string[] {
  if (!roomsArray) return [];
  return roomsArray.filter((r) => r);
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
    const { value: templateName } = await ElMessageBox.prompt("请输入模版名称", "保存为模版", {
      confirmButtonText: "保存",
      cancelButtonText: "取消",
      inputPattern: /.+/,
      inputErrorMessage: "模版名称不能为空",
      inputValue: `模版 ${templates.value.length + 1}`,
    });

    // 深拷贝楼栋配置（不包括楼栋名称）
    const template: Building = {
      name: "",
      templateName: templateName || `模版 ${templates.value.length + 1}`,
      unitCount: building.unitCount,
      units: building.units.map((u) => ({
        name: u.name,
        startFloor: u.startFloor || 1,
        floors: u.floors,
        roomsPerFloor: u.roomsPerFloor,
        startRoom: u.startRoom,
        endRoom: u.endRoom,
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
    startFloor: u.startFloor || 1,
    floors: u.floors,
    roomsPerFloor: u.roomsPerFloor,
    startRoom: u.startRoom,
    endRoom: u.endRoom,
    name: u.name,
    rooms: u.rooms ? [...u.rooms] : [], // 深拷贝rooms数组
  }));

  // 收起当前展开的单元，让用户看到更新效果
  expandedUnit.value = null;
  showRoomConfig.value = false;

  templateDialog.value = false;
  ElMessage.success(`已应用模版到第 ${building.name} 栋，共 ${building.unitCount} 个单元`);
}

// 保存当前展开的单元为单元模版（保存当前设置的单元配置：起始层数/层数/户数/起止房号/已生成房号）
async function saveUnitAsTemplate(buildingIndex: number) {
  const building = configForm.buildings[buildingIndex];
  if (!building || expandedUnit.value === null || !building.units[expandedUnit.value]) {
    ElMessage.warning("请先选择要保存的单元");
    return;
  }

  const unit = building.units[expandedUnit.value];

  // 询问模版名称
  try {
    const { value: templateName } = await ElMessageBox.prompt("请输入单元模版名称", "保存为单元模版", {
      confirmButtonText: "保存",
      cancelButtonText: "取消",
      inputPattern: /.+/,
      inputErrorMessage: "模版名称不能为空",
      inputValue: `单元模版 ${unitTemplates.value.length + 1}`,
    });

    // 深拷贝单元配置（不包括单元名称）
    const template: Unit = {
      name: "",
      templateName: templateName || `单元模版 ${unitTemplates.value.length + 1}`,
      startFloor: unit.startFloor || 1,
      floors: unit.floors,
      roomsPerFloor: unit.roomsPerFloor,
      startRoom: unit.startRoom,
      endRoom: unit.endRoom,
      rooms: unit.rooms ? [...unit.rooms] : [],
    };

    unitTemplates.value.push(template);
    localStorage.setItem("building-unit-templates", JSON.stringify(unitTemplates.value));
    ElMessage.success(`已保存单元模版"${template.templateName}"`);
  } catch (err) {
    // 用户取消
  }
}

// 应用单元模版到当前展开的单元
function applyUnitTemplate(buildingIndex: number) {
  if (expandedUnit.value === null) {
    ElMessage.warning("请先选择要应用模版的单元");
    return;
  }

  if (unitTemplates.value.length === 0) {
    ElMessage.warning("暂无可用单元模版，请先保存");
    return;
  }

  currentUnitBuildingIndex = buildingIndex;
  selectedUnitTemplate.value = null;
  unitTemplateDialog.value = true;
}

// 确认应用单元模版
function confirmApplyUnitTemplate() {
  if (selectedUnitTemplate.value === null) return;

  const building = configForm.buildings[currentUnitBuildingIndex];
  if (!building || expandedUnit.value === null) return;

  const unit = building.units[expandedUnit.value];
  if (!unit) return;

  const template = unitTemplates.value[selectedUnitTemplate.value];

  // 应用单元模版（保留单元名称）
  unit.startFloor = template.startFloor || 1;
  unit.floors = template.floors;
  unit.roomsPerFloor = template.roomsPerFloor;
  unit.startRoom = template.startRoom;
  unit.endRoom = template.endRoom;
  unit.rooms = template.rooms ? [...template.rooms] : [];

  unitTemplateDialog.value = false;

  // 基于模版携带的房号刷新展示快照（保留模版中手工修改过的房号）
  buildRoomSnapshot(unit, currentUnitBuildingIndex, expandedUnit.value);

  ElMessage.success(`已应用单元模版"${template.templateName}"`);
}

// 编辑单元模版名称
async function editUnitTemplateName(index: number) {
  const template = unitTemplates.value[index];
  try {
    const { value: newName } = await ElMessageBox.prompt("请输入新的模版名称", "编辑模版名称", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      inputPattern: /.+/,
      inputErrorMessage: "模版名称不能为空",
      inputValue: template.templateName || `单元模版 ${index + 1}`,
    });

    template.templateName = newName;
    localStorage.setItem("building-unit-templates", JSON.stringify(unitTemplates.value));
    ElMessage.success("模版名称已更新");
  } catch (err) {
    // 用户取消
  }
}

// 删除单个单元模版
async function deleteUnitTemplate(index: number) {
  const template = unitTemplates.value[index];
  try {
    await ElMessageBox.confirm(
      `确定要删除单元模版"${template.templateName || `单元模版 ${index + 1}`}"吗？`,
      "删除模版",
      {
        confirmButtonText: "删除",
        cancelButtonText: "取消",
        type: "warning",
      },
    );

    unitTemplates.value.splice(index, 1);
    localStorage.setItem("building-unit-templates", JSON.stringify(unitTemplates.value));

    // 如果删除的是当前选中的模版，清空选择
    if (selectedUnitTemplate.value === index) {
      selectedUnitTemplate.value = null;
    } else if (selectedUnitTemplate.value !== null && selectedUnitTemplate.value > index) {
      selectedUnitTemplate.value--;
    }

    ElMessage.success("模版已删除");
  } catch (err) {
    // 用户取消
  }
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
    const rooms = unit.rooms;
    if (!rooms || !Array.isArray(rooms)) return total;
    return total + rooms.length;
  }, 0);
}

// 编辑模版名称
async function editTemplateName(index: number) {
  const template = templates.value[index];
  try {
    const { value: newName } = await ElMessageBox.prompt("请输入新的模版名称", "编辑模版名称", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      inputPattern: /.+/,
      inputErrorMessage: "模版名称不能为空",
      inputValue: template.templateName || `模版 ${index + 1}`,
    });

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
    await ElMessageBox.confirm(`确定要删除模版"${template.templateName || `模版 ${index + 1}`}"吗？`, "删除模版", {
      confirmButtonText: "删除",
      cancelButtonText: "取消",
      type: "warning",
    });

    templates.value.splice(index, 1);
    localStorage.setItem("building-templates", JSON.stringify(templates.value));

    // 如果删除的是当前选中的模版，清空选择
    if (selectedTemplate.value === index) {
      selectedTemplate.value = null;
    } else if (selectedTemplate.value !== null && selectedTemplate.value > index) {
      selectedTemplate.value--;
    }

    ElMessage.success("模版已删除");
  } catch (err) {
    // 用户取消
  }
}

async function saveConfig() {
  try {
    // 生成所有单元的房号
    configForm.buildings.forEach((building) => {
      building.units.forEach((unit) => {
        if (!unit.rooms || unit.rooms.length === 0) {
          unit.rooms = generateRoomsFromRule(unit);
        }
      });
    });

    // 转换为后端需要的格式
    const config = {
      type: configType.value, // house 或 shop
      district: configForm.district,
      buildings: configForm.buildings.map((b) => ({
        name: b.name,
        units: b.units.map((u) => ({
          name: u.name,
          startFloor: u.startFloor || 1,
          floors: u.floors,
          roomsPerFloor: u.roomsPerFloor,
          startRoom: u.startRoom,
          endRoom: u.endRoom,
          rooms: u.rooms || [],
        })),
      })),
    };

    await request.post("/house-config", config);
    ElMessage.success(`${configType.value === "house" ? "房屋" : "商铺"}配置保存成功`);
    loadConfig();
  } catch (err) {
    console.error("保存配置失败:", err);
    ElMessage.error("保存失败");
  }
}

async function loadConfig() {
  try {
    const params = { type: configType.value };
    const data: any = await request.get("/house-config", { params });
    if (data.config) {
      const config: any = data.config;
      configForm.district = config.district || "1";
      configForm.buildingCount = config.buildings?.length || 0;
      configForm.buildings =
        config.buildings?.map((b: any) => ({
          name: b.name,
          unitCount: b.units?.length || 0,
          units:
            b.units?.map((u: any) => ({
              name: u.name,
              startFloor: u.startFloor || 1,
              floors: u.floors || 6,
              roomsPerFloor: u.roomsPerFloor || 6,
              startRoom: u.startRoom || "0101",
              endRoom: u.endRoom || "0606",
              rooms: u.rooms || [],
            })) || [],
        })) || [];

      // 为已有房号的单元构建展示快照
      configForm.buildings.forEach((building, bIndex) => {
        building.units.forEach((unit, uIndex) => {
          if (unit.rooms && unit.rooms.length > 0) {
            previewRooms(unit, bIndex, uIndex);
          }
        });
      });
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
  // 加载保存的单元模版
  const savedUnitTemplates = localStorage.getItem("building-unit-templates");
  if (savedUnitTemplates) {
    try {
      unitTemplates.value = JSON.parse(savedUnitTemplates);
    } catch (e) {
      console.error("加载单元模版失败:", e);
    }
  }
});

// 监听配置类型变化，重新加载配置（房屋/商铺两套独立数据源）
watch(configType, () => {
  expandedBuilding.value = null;
  expandedUnit.value = null;
  showBuildingConfig.value = false;
  showUnitConfig.value = false;
  showRoomConfig.value = false;
  if (configType.value === "shop") {
    loadShopConfig();
  } else {
    loadConfig();
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
  display: flex;
  flex-direction: column;
}

.preview-title {
  font-size: 13px;
  color: #303133;
  margin-bottom: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.edit-hint {
  font-size: 12px;
  color: #f56c6c;
  font-weight: 600;
  background: #fef0f0;
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid #fbc4c4;
}

.config-card :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.scrollable-content {
  flex: 1;
  padding-right: 10px;
  overflow-y: auto;
  max-height: calc(100vh - 200px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.config-form {
  margin-top: 20px;
}

/* 商铺配置列表样式（一行 = 一个商铺，门牌号 + 商铺名成对） */
.shop-config-content {
  padding-right: 10px;
}

.shop-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.shop-list-header {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #909399;
  font-size: 13px;
}

.shop-list-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.shop-row-label {
  width: 40px;
  text-align: center;
  flex-shrink: 0;
  color: #606266;
}

.shop-col-label {
  width: 260px;
  text-align: left;
}

.shop-col-input {
  width: 260px;
}

.shop-col-action {
  width: 60px;
  margin-left: 0 !important;
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

.buildings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.building-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  border: 2px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  background: white;
}

.building-item:hover {
  border-color: #409eff;
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.2);
  transform: translateY(-2px);
}

.building-item.active {
  border-color: #409eff;
  background: #ecf5ff;
}

.building-number {
  font-size: 28px;
  font-weight: bold;
  color: #409eff;
  margin-bottom: 8px;
}

.building-name {
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}

.building-config-area {
  margin-top: 20px;
  padding: 20px;
  border: 2px solid #e4e7ed;
  border-radius: 8px;
  background: #f5f7fa;
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.config-header h4 {
  margin: 0;
  color: #409eff;
  font-size: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.config-button-wrapper {
  margin-bottom: 20px;
  text-align: left;
}

.building-setup-area {
  padding: 20px;
  background: #f5f7fa;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 1px solid #e4e7ed;
}

.unit-setup-area {
  padding: 15px;
  background: #fafafa;
  border-radius: 6px;
  margin-bottom: 15px;
  border: 1px solid #e4e7ed;
}

.building-title {
  font-weight: 600;
  font-size: 15px;
}

.building-detail {
  padding: 20px;
  background: white;
  border-radius: 6px;
}

.units-list {
  margin-top: 20px;
}

.units-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.unit-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 15px;
  border: 2px solid #e4e7ed;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
  background: white;
}

.unit-item:hover {
  border-color: #67c23a;
  box-shadow: 0 2px 8px rgba(103, 194, 58, 0.2);
  transform: translateY(-2px);
}

.unit-item.active {
  border-color: #67c23a;
  background: #f0f9ff;
}

.unit-name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.unit-info {
  font-size: 12px;
  color: #909399;
}

.unit-config-area {
  margin-top: 15px;
  padding: 15px;
  border: 2px solid #e4e7ed;
  border-radius: 6px;
  background: white;
}

.unit-card {
  margin-bottom: 15px;
  box-shadow: none;
}

.room-preview {
  margin-top: 10px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
  min-height: 40px;
}

.room-table-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 10px;
}

.room-table-container {
  flex: 1;
}

.reverse-btn {
  flex-shrink: 0;
  margin-top: 0;
}

.room-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 4px;
  overflow: hidden;
}

.room-table th,
.room-table td {
  border: 1px solid #e4e7ed;
  padding: 8px;
  text-align: center;
}

.room-table thead th {
  background: #409eff;
  color: white;
  font-weight: 600;
  font-size: 13px;
}

.floor-header,
.house-header {
  min-width: 60px;
}

.diagonal-header {
  position: relative;
  padding: 8px;
  overflow: hidden;
}

.diagonal-header::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-bottom: 2px solid white;
  transform-origin: bottom left;
  transform: rotate(26deg);
  pointer-events: none;
}

.diagonal-text-bottom {
  position: absolute;
  bottom: 4px;
  left: 6px;
  font-size: 12px;
  z-index: 1;
}

.diagonal-text-top {
  position: absolute;
  top: 4px;
  right: 6px;
  font-size: 12px;
  z-index: 1;
}

.floor-cell {
  background: #ecf5ff;
  color: #409eff;
  font-weight: 600;
  font-size: 13px;
  min-width: 50px;
  max-width: 50px;
  width: 50px;
}

.room-cell {
  min-width: 70px;
  max-width: 70px;
  width: 70px;
  padding: 0;
  text-align: center;
  vertical-align: middle;
  box-sizing: border-box;
}

.room-cell :deep(.el-input) {
  width: 100% !important;
  max-width: 100%;
  display: block;
}

.room-cell :deep(.el-input__wrapper) {
  padding: 0 !important;
  margin: 0 !important;
  box-sizing: border-box;
  box-shadow: none !important;
  background: transparent !important;
  border: none !important;
  width: 100% !important;
}

.room-cell :deep(.el-input__inner) {
  padding: 4px 8px !important;
  margin: 0 !important;
  text-align: center;
  font-size: 13px;
  font-weight: 500;
  height: 100% !important;
  line-height: normal;
  border: none !important;
  box-sizing: border-box;
  width: 100% !important;
}

.room-number {
  display: block;
  width: 100%;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.2s;
  font-size: 13px;
  font-weight: 500;
  box-sizing: border-box;
  text-align: center;
  line-height: normal;
  margin: 0;
}

.room-number:hover {
  background: #ecf5ff;
  color: #409eff;
}

.room-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.room-tag-wrapper {
  display: inline-block;
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

.save-button-wrapper {
  margin-top: 30px;
  padding: 20px 0;
  border-top: 1px solid #ebeef5;
}
</style>
