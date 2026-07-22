<template>
  <div style="padding: 0; height: 100%">
    <!-- 顶部操作栏 -->
    <div class="admin-topbar" style="margin-bottom: 12px">
      <div class="left" style="display: flex; align-items: center; gap: 12px">
        <span style="font-size: 15px; font-weight: 600">门禁管理</span>
        <el-select
          v-model="selectedCommunityId"
          placeholder="请选择小区"
          clearable
          filterable
          style="width: 240px"
          @change="onCommunityChange"
        >
          <el-option
            v-for="c in communities"
            :key="c._id"
            :label="c.name"
            :value="c._id"
          />
        </el-select>
      </div>
    </div>

    <template v-if="!selectedCommunityId">
      <el-empty description="请先选择要管理的小区" style="margin-top: 80px" />
    </template>

    <template v-else>
      <el-tabs v-model="activeTab" type="card">
        <el-tab-pane label="门禁设备" name="devices">
          <DoorManagement
            :communityId="selectedCommunityId"
            :key="`dev-${selectedCommunityId}`"
          />
        </el-tab-pane>
        <el-tab-pane label="开门权限" name="permissions">
          <DoorPermissionManagement
            :communityId="selectedCommunityId"
            :key="`perm-${selectedCommunityId}`"
          />
        </el-tab-pane>
      </el-tabs>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import request from "../utils/axios";
import DoorManagement from "./DoorManagement.vue";
import DoorPermissionManagement from "./DoorPermissionManagement.vue";

const route = useRoute();
const router = useRouter();

const communities = ref<{ _id: string; name: string }[]>([]);
const selectedCommunityId = ref<string>(
  (route.query.communityId as string) || "",
);
const activeTab = ref("devices");

async function loadCommunities() {
  try {
    const res: any = await request.get("/communities", {
      params: { page: 1, pageSize: 1000 },
    });
    communities.value = (res.data || res || [])
      .filter((c: any) => c.doorManagementEnabled === true)
      .map((c: any) => ({
        _id: c._id,
        name: c.name || c._id,
      }));
  } catch (e: any) {
    ElMessage.error("加载小区列表失败：" + (e?.message || "未知错误"));
  }
}

function onCommunityChange(val: string) {
  router.replace({
    path: "/admin/door",
    query: val ? { communityId: val } : {},
  });
}

// 监听路由 query 变化（从创建页返回时同步）
watch(
  () => route.query.communityId,
  (val) => {
    if (typeof val === "string" && val !== selectedCommunityId.value) {
      selectedCommunityId.value = val;
    }
  },
);

onMounted(() => {
  loadCommunities();
});
</script>
