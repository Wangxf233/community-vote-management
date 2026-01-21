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
        <el-alert
          title="配置说明"
          type="info"
          :closable="false"
          style="margin-bottom: 20px"
        >
          <span v-if="configType === 'house'"
            >请配置小区的房屋结构信息，业主提交审核时将根据此配置选择房号</span
          >
          <span v-else
            >请配置小区的商铺信息，业主提交审核时将根据此配置选择门牌号。备注：若商铺无期/区号、栋号、单元号，则留空</span
          >
        </el-alert>

        <el-form :model="configForm" label-width="120px" class="config-form">
          <el-form-item label="小区期/区号">
            <el-input
              v-model="configForm.district"
              placeholder="例如：1"
              style="width: 200px"
            />
            <span class="tip" style="margin-left: 8px"
              >若小区只有1期/区，填1即可</span
            >
          </el-form-item>

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
            <h3>
              {{ configType === "house" ? "楼栋详细配置" : "商铺详细配置" }}
            </h3>
            <el-collapse accordion :key="`collapse-${configType}`">
              <el-collapse-item
                v-for="(building, bIndex) in configForm.buildings"
                :key="`building-${configType}-${bIndex}`"
                :name="String(bIndex)"
              >
                <template #title>
                  <span class="building-title">
                    {{ building.name }} 栋
                    <template v-if="building.units.length > 0">
                      <el-tag
                        v-for="unit in building.units"
                        :key="unit.name"
                        size="small"
                        style="margin-left: 8px"
                      >
                        {{ unit.name }}单元
                      </el-tag>
                    </template>
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
                            <span>第 {{ unit.name }} 单元</span>
                          </template>
                          <el-form-item label="单元名称" label-width="100px">
                            <el-input
                              v-model="unit.name"
                              placeholder="例如：1"
                              size="small"
                              style="width: 150px"
                            />
                          </el-form-item>

                          <el-divider content-position="left"
                            >房号生成规则</el-divider
                          >

                          <el-form-item label="层数" label-width="100px">
                            <el-input-number
                              v-model="unit.floors"
                              :min="1"
                              :max="100"
                              size="small"
                              style="width: 150px"
                            />
                          </el-form-item>

                          <el-form-item label="一层几户" label-width="100px">
                            <el-input-number
                              v-model="unit.roomsPerFloor"
                              :min="1"
                              :max="20"
                              size="small"
                              style="width: 150px"
                            />
                          </el-form-item>

                          <el-form-item
                            :label="
                              configType === 'house' ? '起始户号' : '起始门牌号'
                            "
                            label-width="100px"
                          >
                            <el-input
                              v-model="unit.startRoom"
                              placeholder="例如：0101"
                              size="small"
                              style="width: 150px"
                              maxlength="4"
                              @input="
                                unit.startRoom = unit.startRoom.replace(
                                  /\D/g,
                                  '',
                                )
                              "
                            />
                            <span class="tip" style="margin-left: 8px"
                              >四位数字，例如：0101</span
                            >
                          </el-form-item>

                          <el-form-item
                            :label="
                              configType === 'house' ? '结束户号' : '结束门牌号'
                            "
                            label-width="100px"
                          >
                            <el-input
                              v-model="unit.endRoom"
                              placeholder="例如：0606"
                              size="small"
                              style="width: 150px"
                              maxlength="4"
                              @input="
                                unit.endRoom = unit.endRoom.replace(/\D/g, '')
                              "
                            />
                            <span class="tip" style="margin-left: 8px"
                              >四位数字，例如：0606</span
                            >
                          </el-form-item>

                          <el-button
                            type="primary"
                            size="small"
                            @click="previewRooms(unit)"
                            style="margin-bottom: 10px"
                          >
                            生成预览
                          </el-button>

                          <div
                            class="room-preview"
                            v-if="unit.rooms && unit.rooms.length > 0"
                          >
                            <div class="preview-title">
                              生成的{{
                                configType === "house" ? "房号" : "门牌号"
                              }}（共 {{ unit.rooms.length }} 个）
                              <span class="edit-hint">双击房号可修改</span>
                            </div>
                            <div class="room-table-wrapper">
                              <div class="room-table-container">
                                <table class="room-table">
                                  <thead>
                                    <tr>
                                      <th class="floor-header diagonal-header">
                                        <span class="diagonal-text-bottom"
                                          >楼层</span
                                        >
                                        <span class="diagonal-text-top"
                                          >户号</span
                                        >
                                      </th>
                                      <th
                                        v-for="houseNum in getHouseNumList(
                                          unit,
                                          bIndex,
                                          uIndex,
                                        )"
                                        :key="houseNum"
                                        class="house-header"
                                      >
                                        {{ houseNum }}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr
                                      v-for="floor in Array.from(
                                        { length: unit.floors },
                                        (_, i) => unit.floors - i,
                                      )"
                                      :key="floor"
                                    >
                                      <td class="floor-cell">{{ floor }}</td>
                                      <td
                                        v-for="houseNum in getHouseNumList(
                                          unit,
                                          bIndex,
                                          uIndex,
                                        )"
                                        :key="`${floor}-${houseNum}`"
                                        class="room-cell"
                                      >
                                        <el-input
                                          v-if="
                                            editingRoom ===
                                            `${bIndex}-${uIndex}-${getRoomIndex(
                                              unit,
                                              floor,
                                              houseNum,
                                            )}`
                                          "
                                          v-model="
                                            unit.rooms[
                                              getRoomIndex(
                                                unit,
                                                floor,
                                                houseNum,
                                              )
                                            ]
                                          "
                                          size="small"
                                          maxlength="10"
                                          style="width: 100%"
                                          @blur="editingRoom = null"
                                          @keyup.enter="editingRoom = null"
                                        />
                                        <span
                                          v-else
                                          class="room-number"
                                          @dblclick="
                                            editingRoom = `${bIndex}-${uIndex}-${getRoomIndex(
                                              unit,
                                              floor,
                                              houseNum,
                                            )}`
                                          "
                                        >
                                          {{
                                            getRoomByPosition(
                                              unit,
                                              floor,
                                              houseNum,
                                            )
                                          }}
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
                                @click="toggleHouseNumOrder(bIndex, uIndex)"
                              >
                                户号逆序
                              </el-button>
                            </div>
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

          <div
            v-if="configForm.buildings.length > 0"
            class="save-button-wrapper"
          >
            <el-button
              type="primary"
              size="large"
              @click="saveConfig"
              style="width: 100%"
            >
              保存配置
            </el-button>
          </div>
        </el-form>
      </div>
    </el-card>

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
  floors: number; // 层数
  roomsPerFloor: number; // 一层几户
  startRoom: string; // 起始房号（4位数字符串）
  endRoom: string; // 结束房号（4位数字符串）
  rooms?: string[]; // 生成的房号列表
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

// 模版相关
const templates = ref<Building[]>([]);
const templateDialog = ref(false);
const selectedTemplate = ref<number | null>(null);
const editingRoom = ref<string | null>(null); // 当前正在编辑的房号，格式：buildingIndex-unitIndex-roomIndex
const reverseHouseNum = ref<{ [key: string]: boolean }>({}); // 记录每个单元的户号是否逆序，key格式：buildingIndex-unitIndex
let currentBuildingIndex = -1;

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
  const startFloor = parseInt(startRoom.substring(0, 2), 10);
  const startHouse = parseInt(startRoom.substring(2, 4), 10);
  const endFloor = parseInt(endRoom.substring(0, 2), 10);
  const endHouse = parseInt(endRoom.substring(2, 4), 10);

  if (
    isNaN(startFloor) ||
    isNaN(startHouse) ||
    isNaN(endFloor) ||
    isNaN(endHouse)
  ) {
    return [];
  }

  // 遍历每层，每层从起始户号到结束户号
  for (let floor = 1; floor <= floors; floor++) {
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

// 预览生成的房号
function previewRooms(unit: Unit) {
  unit.rooms = generateRoomsFromRule(unit);
}

// 切换户号逆序
function toggleHouseNumOrder(bIndex: number, uIndex: number) {
  const key = `${bIndex}-${uIndex}`;
  reverseHouseNum.value[key] = !reverseHouseNum.value[key];
}

// 获取户号列表（根据逆序状态）
function getHouseNumList(unit: Unit, bIndex: number, uIndex: number): number[] {
  const startHouse = parseInt(unit.startRoom.substring(2, 4), 10);
  const endHouse = parseInt(unit.endRoom.substring(2, 4), 10);
  const list: number[] = [];
  for (let i = startHouse; i <= endHouse; i++) {
    list.push(i);
  }
  const key = `${bIndex}-${uIndex}`;
  return reverseHouseNum.value[key] ? list.reverse() : list;
}

// 根据楼层和户号获取房号在数组中的索引
function getRoomIndex(unit: Unit, floor: number, houseNum: number): number {
  const startHouse = parseInt(unit.startRoom.substring(2, 4), 10);
  return (floor - 1) * unit.roomsPerFloor + (houseNum - startHouse);
}

// 根据楼层和户号获取房号
function getRoomByPosition(
  unit: Unit,
  floor: number,
  houseNum: number,
): string {
  if (!unit.rooms) return "";
  const index = getRoomIndex(unit, floor, houseNum);
  return unit.rooms[index] || "";
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
    const { value: templateName } = await ElMessageBox.prompt(
      "请输入模版名称",
      "保存为模版",
      {
        confirmButtonText: "保存",
        cancelButtonText: "取消",
        inputPattern: /.+/,
        inputErrorMessage: "模版名称不能为空",
        inputValue: `模版 ${templates.value.length + 1}`,
      },
    );

    // 深拷贝楼栋配置（不包括楼栋名称）
    const template: Building = {
      name: "",
      templateName: templateName || `模版 ${templates.value.length + 1}`,
      unitCount: building.unitCount,
      units: building.units.map((u) => ({
        name: u.name,
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
    floors: u.floors,
    roomsPerFloor: u.roomsPerFloor,
    startRoom: u.startRoom,
    endRoom: u.endRoom,
    name: u.name,
    rooms: u.rooms ? [...u.rooms] : [], // 深拷贝rooms数组
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
    const rooms = unit.rooms;
    if (!rooms || !Array.isArray(rooms)) return total;
    return total + rooms.length;
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
      },
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
      },
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
          rooms: u.rooms || [],
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
    const params = { type: configType.value };
    const data = await request.get("/house-config", { params });
    if (data.config) {
      const config = data.config;
      configForm.district = config.district || "1";
      configForm.buildingCount = config.buildings?.length || 0;
      configForm.buildings =
        config.buildings?.map((b: any) => ({
          name: b.name,
          unitCount: b.units?.length || 0,
          units:
            b.units?.map((u: any) => ({
              name: u.name,
              floors: 6,
              roomsPerFloor: 6,
              startRoom: "0101",
              endRoom: "0606",
              rooms: u.rooms || [],
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

// 监听配置类型变化，重新加载配置
watch(configType, () => {
  loadConfig();
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
