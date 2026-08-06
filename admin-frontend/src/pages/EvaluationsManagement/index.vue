<template>
  <div
    style="
      height: calc(100vh - 96px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    "
  >
    <!-- 选项卡切换 -->
    <el-card style="margin-bottom: 12px; flex-shrink: 0">
      <div style="display: flex; align-items: center; justify-content: space-between">
        <el-radio-group v-model="activeTab" @change="handleTabChange">
          <el-radio-button label="staff">服务人员</el-radio-button>
          <el-radio-button label="company">物业公司</el-radio-button>
        </el-radio-group>
        <div style="display: flex; align-items: center; gap: 8px">
          <span style="font-size: 13px; color: #909399">实名认证</span>
          <el-switch
            v-model="realNameRequired"
            :loading="realNameLoading"
            @change="onRealNameToggle"
          />
          <el-tooltip content="开启后，小程序用户必须完成实名认证才能使用投票和评价功能；关闭后用户可直接使用，无需实名认证" placement="bottom">
            <el-icon style="color: #909399; cursor: help"><QuestionFilled /></el-icon>
          </el-tooltip>
        </div>
      </div>
    </el-card>

    <!-- 内容区域 -->
    <div style="flex: 1; overflow: hidden">
      <div v-if="activeTab === 'staff'">
        <div v-if="hasPermission('service_evaluation')">
          <StaffManagement />
        </div>
        <div
          v-else
          style="
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
          "
        >
          <el-empty description="暂无权限" />
        </div>
      </div>

      <div v-else-if="activeTab === 'company'">
        <div v-if="hasPermission('property_evaluation')">
          <CompanyManagement />
        </div>
        <div
          v-else
          style="
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
          "
        >
          <el-empty description="暂无权限" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { QuestionFilled } from "@element-plus/icons-vue";
import request from "@/utils/axios";
import StaffManagement from "./StaffManagement.vue";
import CompanyManagement from "./CompanyManagement.vue";

const activeTab = ref(
  sessionStorage.getItem("evaluationsManagement_activeTab") || "staff"
);

const handleTabChange = (tab: string) => {
  activeTab.value = tab;
};

const userPermissions = ref<string[]>([]);
const userRole = ref<string>("");

function loadPermissions() {
  try {
    const raw = localStorage.getItem("admin-user");
    if (raw) {
      const user = JSON.parse(raw);
      userRole.value = user.role || "";
      userPermissions.value = user.permissions || [];
    }
  } catch (e) {
    console.error(e);
  }
}

function hasPermission(perm: string) {
  // 总管理员拥有所有权限
  if (userRole.value === "super" || userRole.value === "admin") {
    return true;
  }
  return userPermissions.value.includes(perm);
}

const realNameRequired = ref(true);
const realNameLoading = ref(false);

async function fetchRealNameSetting() {
  try {
    const user = JSON.parse(localStorage.getItem("admin-user") || "{}");
    const communityId = user.communityId;
    if (!communityId) return;
    const res: any = await request.get(`/communities/${communityId}/real-name-setting`);
    realNameRequired.value = res.requireRealName !== false;
  } catch (e) {
    console.error("获取实名认证开关失败:", e);
  }
}

async function onRealNameToggle(val: boolean) {
  if (!val) {
    try {
      await ElMessageBox.confirm(
        "关闭实名认证后，未实名的小程序用户也可以直接参与投票和评价。这可能导致投票过程不够规范，请确认是否继续？",
        "关闭实名认证",
        { confirmButtonText: "确认关闭", cancelButtonText: "取消", type: "warning" },
      );
    } catch {
      realNameRequired.value = true;
      return;
    }
  }
  realNameLoading.value = true;
  try {
    const user = JSON.parse(localStorage.getItem("admin-user") || "{}");
    const communityId = user.communityId;
    await request.put(`/communities/${communityId}/real-name-setting`, {
      requireRealName: val,
    });
    ElMessage.success(val ? "已开启实名认证" : "已关闭实名认证");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || "设置失败");
    realNameRequired.value = !val;
  } finally {
    realNameLoading.value = false;
  }
}

onMounted(() => {
  loadPermissions();
  fetchRealNameSetting();
});

// 监听 activeTab 变化并保存到 sessionStorage
watch(activeTab, (newTab) => {
  sessionStorage.setItem("evaluationsManagement_activeTab", newTab);
});
</script>

<style scoped>
.coming-soon {
  padding: 40px;
  text-align: center;
  font-size: 16px;
  color: #909399;
}
</style>
