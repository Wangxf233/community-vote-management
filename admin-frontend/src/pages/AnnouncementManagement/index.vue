<template>
  <div
    style="
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    "
  >
    <!-- 顶部选项卡 -->
    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <el-tab-pane label="业委会信息公示" name="committee" />
      <el-tab-pane label="物业信息公示" name="property" />
      <el-tab-pane label="法律法规" name="law" />
    </el-tabs>

    <!-- 内容区域 -->
    <div style="flex: 1; overflow: hidden">
      <div v-if="hasPermission('announcement')">
        <AnnouncementList :type="activeTab" />
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
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import AnnouncementList from "./AnnouncementList.vue";

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

const activeTab = ref(
  sessionStorage.getItem("announcementManagement_activeTab") || "committee"
);

const handleTabChange = (tab: string) => {
  activeTab.value = tab;
};

// 监听 activeTab 变化并保存到 sessionStorage
watch(activeTab, (newTab) => {
  sessionStorage.setItem("announcementManagement_activeTab", newTab);
});

// 检查是否需要跳转到特定tab
onMounted(() => {
  const targetTab = sessionStorage.getItem("announcementManagement_targetTab");
  if (targetTab) {
    activeTab.value = targetTab;
    sessionStorage.removeItem("announcementManagement_targetTab");
  }
  loadPermissions();
});
</script>
