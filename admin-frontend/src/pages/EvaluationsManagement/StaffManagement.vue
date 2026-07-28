<template>
  <div
    style="
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    "
  >
    <!-- 二级导航 -->
    <el-tabs v-model="subTab" @tab-change="handleSubTabChange">
      <el-tab-pane label="评价周期" name="cycles" />
      <el-tab-pane label="评价结果" name="results" />
      <el-tab-pane label="服务人员库" name="staff" />
    </el-tabs>

    <!-- 内容区域 -->
    <div style="flex: 1; overflow: hidden">
      <cycles-list v-if="subTab === 'cycles'" />
      <results-list v-else-if="subTab === 'results'" />
      <staff-list v-else-if="subTab === 'staff'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import CyclesList from "./CyclesList.vue";
import ResultsList from "./ResultsList.vue";
import StaffList from "./StaffList.vue";

const subTab = ref(
  sessionStorage.getItem("evaluationsManagement_subTab") || "cycles"
);

const handleSubTabChange = (tab: string) => {
  subTab.value = tab;
};

// 监听 subTab 变化并保存到 sessionStorage
watch(subTab, (newTab) => {
  sessionStorage.setItem("evaluationsManagement_subTab", newTab);
});

// 检查是否需要跳转到结果页
onMounted(() => {
  const targetTab = sessionStorage.getItem("evaluationsManagement_targetTab");
  if (targetTab) {
    subTab.value = targetTab;
    sessionStorage.removeItem("evaluationsManagement_targetTab");
  }
});
</script>

<style scoped></style>
