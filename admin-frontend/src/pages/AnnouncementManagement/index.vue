<template>
  <div
    style="
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    "
  >
    <!-- 内容区域 -->
    <div style="flex: 1; overflow: hidden">
      <div v-if="hasPermission('announcement')" style="height: 100%">
        <announcement-list :key="currentType" :type="currentType" />
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
import { computed, ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import AnnouncementList from "./AnnouncementList.vue";

const route = useRoute();
const userPermissions = ref<string[]>([]);
const userRole = ref<string>("");

const currentType = computed(() => (route.query.tab as string) || "committee");

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
  if (userRole.value === "super" || userRole.value === "admin") {
    return true;
  }
  return userPermissions.value.includes(perm);
}

onMounted(() => {
  loadPermissions();
});
</script>
