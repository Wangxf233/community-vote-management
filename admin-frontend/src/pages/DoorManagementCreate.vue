<template>
  <div class="door-create-page">
    <el-card class="mb16">
      <template #header>
        <div class="header-row">
          <div class="card-title">添加设备</div>
          <el-button @click="goBack">返回设备列表</el-button>
        </div>
      </template>
      <el-alert type="info" :closable="false" show-icon>
        <template #title>
          <span v-if="mode === 'unregistered'"
            >步骤1将设备注册到厂商平台，步骤2配置门禁业务信息。</span
          >
          <span v-else
            >设备已在厂商侧完成注册，直接输入序列号配置门禁信息即可。</span
          >
        </template>
      </el-alert>

      <div style="margin-top: 16px">
        <el-radio-group v-model="mode">
          <el-radio value="unregistered">设备尚未在厂商侧注册</el-radio>
          <el-radio value="registered">设备已在厂商侧注册</el-radio>
        </el-radio-group>
      </div>
    </el-card>

    <el-row :gutter="16">
      <el-col :xs="24" :lg="14">
        <el-card v-if="mode === 'unregistered'">
          <template #header>
            <div class="card-title">步骤1：厂商注册（loginId流程）</div>
          </template>
          <el-form :model="registerForm" label-width="130px" size="small">
            <el-form-item label="loginId">
              <el-input
                v-model="registerForm.loginId"
                placeholder="管理用户ID（数字）"
              />
            </el-form-item>
            <el-form-item label="loginPassword">
              <el-input
                v-model="registerForm.loginPassword"
                type="password"
                show-password
              />
            </el-form-item>
            <el-form-item label="platform">
              <el-input v-model="registerForm.platform" />
            </el-form-item>
            <el-form-item label="serial">
              <el-input v-model="registerForm.serial" />
            </el-form-item>
            <el-form-item label="devicePassword">
              <el-input v-model="registerForm.devicePassword" />
            </el-form-item>
            <el-form-item label="deviceNo">
              <el-input v-model="registerForm.deviceNo" />
            </el-form-item>
            <el-form-item label="deviceType">
              <el-input
                v-model="registerForm.deviceType"
                placeholder="请输入设备类型，例如：1"
              />
            </el-form-item>
            <el-form-item label="mac">
              <el-input v-model="registerForm.mac" />
            </el-form-item>
            <el-form-item label="algorithm">
              <el-input
                v-model="registerForm.algorithm"
                placeholder="请输入算法类型，例如：0"
              />
            </el-form-item>
            <el-form-item label="sourceid">
              <el-input v-model="registerForm.sourceid" />
            </el-form-item>
            <el-form-item label="id">
              <el-input v-model="registerForm.id" />
            </el-form-item>
            <el-form-item label="keyType">
              <el-input
                v-model="registerForm.keyType"
                placeholder="请输入密钥类型，例如：1"
              />
            </el-form-item>
            <el-form-item label="keyCount">
              <el-input
                v-model="registerForm.keyCount"
                placeholder="请输入密钥数量，例如：1"
              />
            </el-form-item>
            <el-form-item label="keyId(自动)">
              <el-input
                v-model="registerForm.keyId"
                placeholder="半角逗号分隔，默认自动填1个"
              />
            </el-form-item>
            <el-form-item label="startDate选择">
              <el-date-picker
                v-model="registerForm.startDateLocal"
                type="datetime"
                value-format="x"
                format="YYYY-MM-DD HH:mm:ss"
                placeholder="选择时间后自动转UTC秒"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item label="startDate(UTC秒)">
              <el-input
                v-model="registerForm.startDate"
                placeholder="支持半角逗号分隔"
              />
            </el-form-item>
            <el-form-item label="keyDate选择">
              <el-date-picker
                v-model="registerForm.keyDateLocal"
                type="datetime"
                value-format="x"
                format="YYYY-MM-DD HH:mm:ss"
                placeholder="选择时间后自动转UTC秒"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item label="keyDate(UTC秒)">
              <el-input
                v-model="registerForm.keyDate"
                placeholder="支持半角逗号分隔"
              />
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                :loading="registering"
                @click="registerVendor"
                >调用厂商注册</el-button
              >
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="10">
        <el-card>
          <template #header>
            <div class="card-title">步骤2：保存并配置门禁</div>
          </template>
          <el-form :model="deviceForm" label-width="110px" size="small">
            <el-form-item label="设备序列号">
              <el-input v-model="deviceForm.serial" placeholder="设备 serial" />
            </el-form-item>

            <el-form-item label="设备密码">
              <el-input
                v-model="deviceForm.password"
                placeholder="Fondcard 设备密码"
              />
            </el-form-item>

            <el-form-item label="设备名称">
              <el-input
                v-model="deviceForm.deviceName"
                placeholder="例如：测试门禁-西门"
              />
            </el-form-item>

            <el-form-item label="门禁类型">
              <el-select
                v-model="deviceForm.locationType"
                style="width: 100%"
                @change="onLocationTypeChange"
              >
                <el-option label="小区大门" value="community_gate" />
                <el-option label="楼栋单元门" value="unit_gate" />
              </el-select>
            </el-form-item>

            <template v-if="deviceForm.locationType === 'community_gate'">
              <el-form-item label="大门地点">
                <el-input
                  v-model="deviceForm.gateName"
                  placeholder="例如：小区西门/东门/南门"
                />
              </el-form-item>
            </template>

            <template v-else>
              <el-form-item label="楼栋">
                <el-select
                  v-model="deviceForm.building"
                  style="width: 100%"
                  @change="onBuildingChange"
                >
                  <el-option
                    v-for="item in buildingOptions"
                    :key="item.building"
                    :label="item.buildingName"
                    :value="item.building"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="单元">
                <el-select v-model="deviceForm.unit" style="width: 100%">
                  <el-option
                    v-for="u in unitOptions"
                    :key="u"
                    :label="u"
                    :value="u"
                  />
                </el-select>
              </el-form-item>
            </template>

            <el-form-item>
              <el-button type="primary" :loading="saving" @click="saveDevice"
                >保存配置</el-button
              >
              <el-button @click="resetForm">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import request from "../utils/axios";

type BuildingOption = {
  building: string;
  buildingName: string;
  units: string[];
};

type DoorDevice = {
  _id: string;
  deviceName: string;
  serial: string;
  password: string;
  enabled: boolean;
  locationType: "community_gate" | "unit_gate";
  gateName?: string;
  building?: string;
  unit?: string;
  locationLabel?: string;
  buildingLabel?: string;
  unitLabel?: string;
};

const router = useRouter();
const saving = ref(false);
const registering = ref(false);
const mode = ref<"unregistered" | "registered">("unregistered");

const props = defineProps<{
  communityId?: string;
}>();
const buildingOptions = ref<BuildingOption[]>([]);

const registerForm = reactive({
  loginId: "",
  loginPassword: "",
  platform: "",
  serial: "",
  devicePassword: "",
  deviceNo: "",
  deviceType: "1",
  mac: "",
  algorithm: "1",
  sourceid: "",
  id: "",
  keyType: "1",
  keyCount: "1",
  keyId: "",
  startDate: "",
  keyDate: "",
  startDateLocal: "",
  keyDateLocal: "",
});

const deviceForm = reactive({
  serial: "",
  password: "",
  deviceName: "",
  locationType: "community_gate" as "community_gate" | "unit_gate",
  gateName: "",
  building: "",
  unit: "",
});

const unitOptions = computed(() => {
  const target = buildingOptions.value.find(
    (item) => item.building === deviceForm.building,
  );
  return target ? target.units : [];
});

function toHex8(value: string | number) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return "";
  }
  return n.toString(16).toUpperCase().padStart(8, "0").slice(-8);
}

function toUnixUtcSeconds(value: string | number | Date) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (value instanceof Date) {
    return Math.floor(value.getTime() / 1000);
  }
  if (typeof value === "number") {
    return Math.floor(value / 1000);
  }
  const num = Number(value);
  if (Number.isFinite(num)) {
    return Math.floor(num / 1000);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return Math.floor(parsed.getTime() / 1000);
}

watch(
  () => registerForm.loginId,
  (value) => {
    registerForm.keyId = toHex8(value) || "";
  },
  { immediate: true },
);

watch(
  () => registerForm.startDateLocal,
  (value) => {
    const utcSec = toUnixUtcSeconds(value);
    if (utcSec) {
      registerForm.startDate = String(utcSec);
    }
  },
);

watch(
  () => registerForm.keyDateLocal,
  (value) => {
    const utcSec = toUnixUtcSeconds(value);
    if (utcSec) {
      registerForm.keyDate = String(utcSec);
    }
  },
);

function goBack() {
  if (props.communityId) {
    router.push(`/admin/door?communityId=${props.communityId}`);
  } else {
    router.push("/community-admin/door-management");
  }
}

function onLocationTypeChange() {
  if (deviceForm.locationType === "community_gate") {
    deviceForm.building = "";
    deviceForm.unit = "";
  } else {
    deviceForm.gateName = "";
  }
}

function onBuildingChange() {
  deviceForm.unit = "";
}

function resetForm() {
  Object.assign(deviceForm, {
    serial: "",
    password: "",
    deviceName: "",
    locationType: "community_gate",
    gateName: "",
    building: "",
    unit: "",
  });
}

async function loadLocationOptions() {
  const params: Record<string, string> = {};
  if (props.communityId) params.communityId = props.communityId;
  const body: any = await request.get("/door/location-options", { params });
  buildingOptions.value = body?.data?.buildings || [];
}

async function registerVendor() {
  const required = [
    "loginId",
    "loginPassword",
    "platform",
    "serial",
    "devicePassword",
    "deviceNo",
    "deviceType",
    "mac",
    "algorithm",
    "sourceid",
    "id",
    "keyType",
    "keyCount",
    "keyId",
  ] as const;

  for (const key of required) {
    if (!registerForm[key]) {
      ElMessage.warning(`请填写 ${key}`);
      return;
    }
  }

  if (!registerForm.startDate || !registerForm.keyDate) {
    ElMessage.warning("请填写 startDate 与 keyDate（UTC秒，支持半角逗号分隔）");
    return;
  }

  registering.value = true;
  try {
    await request.post("/door/fondcard/bootstrap", {
      loginId: registerForm.loginId,
      loginPassword: registerForm.loginPassword,
      platform: registerForm.platform,
      serial: registerForm.serial,
      devicePassword: registerForm.devicePassword,
      ...(props.communityId ? { communityId: props.communityId } : {}),
      deviceNo: Number(registerForm.deviceNo),
      deviceType: Number(registerForm.deviceType),
      mac: registerForm.mac,
      algorithm: Number(registerForm.algorithm),
      sourceid: registerForm.sourceid,
      id: registerForm.id,
      keyType: Number(registerForm.keyType),
      keyCount: Number(registerForm.keyCount),
      keyId: registerForm.keyId,
      startDate: registerForm.startDate,
      keyDate: registerForm.keyDate,
    });

    ElMessage.success("厂商注册成功，已自动关联当前小区与当前登录用户");
    deviceForm.serial = registerForm.serial;
    deviceForm.password = registerForm.devicePassword;
  } catch (error: any) {
    console.error(error);
    const msg =
      error?.response?.data?.error || error?.message || "厂商注册失败";
    ElMessage.error(msg);
  } finally {
    registering.value = false;
  }
}

async function saveDevice() {
  if (!deviceForm.serial) {
    ElMessage.warning("请输入设备序列号");
    return;
  }
  if (!deviceForm.password) {
    ElMessage.warning("请输入设备密码");
    return;
  }
  if (!deviceForm.deviceName) {
    ElMessage.warning("请输入设备名称");
    return;
  }

  if (deviceForm.locationType === "community_gate" && !deviceForm.gateName) {
    ElMessage.warning("请填写大门地点");
    return;
  }

  if (
    deviceForm.locationType === "unit_gate" &&
    (!deviceForm.building || !deviceForm.unit)
  ) {
    ElMessage.warning("请选择楼栋和单元");
    return;
  }

  saving.value = true;
  try {
    await request.post("/door/devices", {
      serial: deviceForm.serial,
      password: deviceForm.password,
      deviceName: deviceForm.deviceName,
      locationType: deviceForm.locationType,
      gateName: deviceForm.gateName,
      building: deviceForm.building,
      buildingLabel: deviceForm.building,
      unit: deviceForm.unit,
      unitLabel: deviceForm.unit,
      ...(props.communityId ? { communityId: props.communityId } : {}),
    });
    ElMessage.success("门禁配置已保存");
    resetForm();
  } catch (error: any) {
    console.error(error);
    const msg = error?.response?.data?.error || error?.message || "保存失败";
    ElMessage.error(msg);
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await loadLocationOptions();
});
</script>

<style scoped>
.door-create-page {
  padding-bottom: 16px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-weight: 600;
}

.mb16 {
  margin-bottom: 16px;
}
</style>
