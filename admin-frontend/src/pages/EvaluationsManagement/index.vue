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
      <el-radio-group v-model="activeTab" @change="handleTabChange">
        <el-radio-button label="staff">服务人员</el-radio-button>
        <el-radio-button label="company">物业公司</el-radio-button>
      </el-radio-group>
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

onMounted(() => {
  loadPermissions();
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
