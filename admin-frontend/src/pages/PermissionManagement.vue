<template>
  <div
    style="
      height: calc(100vh - 96px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    "
  >
    <!-- 筛选条件表单 -->
    <el-card style="margin-bottom: 12px; flex-shrink: 0">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="所属部门" style="margin-bottom: 0">
          <el-select
            v-model="filters.department"
            placeholder="所属部门"
            style="width: 120px"
          >
            <el-option label="全部" value="" />
            <el-option label="业委会" value="业委会" />
            <el-option label="物业公司" value="物业公司" />
          </el-select>
        </el-form-item>
        <el-form-item label="职位" style="margin-bottom: 0">
          <el-input v-model="filters.position" placeholder="职位" />
        </el-form-item>
        <el-form-item label="姓名" style="margin-bottom: 0">
          <el-input v-model="filters.name" placeholder="姓名" />
        </el-form-item>
        <el-form-item style="margin-bottom: 0">
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 数据表格 -->
    <el-card
      style="flex: 1; display: flex; flex-direction: column; overflow: hidden"
    >
      <div
        style="
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        "
      >
        <div>
          <span style="font-weight: 600">权限管理</span>
          <span style="margin-left: 12px; color: #999">共 {{ total }} 人</span>
        </div>
      </div>

      <div style="flex: 1; width: 100%; overflow: hidden">
        <el-table :data="members" stripe style="width: 100%" height="100%">
          <el-table-column
            label="所属部门"
            prop="department"
            width="120"
            align="center"
          />
          <el-table-column
            label="职位"
            prop="position"
            width="150"
            align="center"
          />
          <el-table-column
            label="姓名"
            prop="name"
            width="150"
            align="center"
          />
          <el-table-column label="已有权限" min-width="300">
            <template #default="{ row }">
              <el-tag
                v-for="perm in row.permissions"
                :key="perm"
                size="small"
                style="margin-right: 4px"
              >
                {{ getPermissionLabel(perm) }}
              </el-tag>
              <span
                v-if="!row.permissions || row.permissions.length === 0"
                style="color: #999"
                >暂无权限</span
              >
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" align="center">
            <template #default="{ row }">
              <el-button
                type="primary"
                size="small"
                @click="openPermissionDrawer(row)"
              >
                权限管理
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <!-- 权限管理侧边栏 -->
    <el-drawer
      v-model="permissionDrawer"
      title="权限管理"
      size="400px"
      direction="rtl"
    >
      <div v-if="currentMember">
        <div
          style="
            margin-bottom: 16px;
            padding: 12px;
            background: #f5f7fa;
            border-radius: 4px;
          "
        >
          <div><strong>姓名：</strong>{{ currentMember.name }}</div>
          <div style="margin-top: 4px">
            <strong>职位：</strong>{{ currentMember.position }}
          </div>
        </div>

        <el-checkbox
          v-model="selectAll"
          @change="onSelectAllChange"
          style="margin-bottom: 12px; font-weight: 600"
        >
          全选
        </el-checkbox>

        <el-checkbox-group v-model="selectedPermissions">
          <div
            v-for="perm in availablePermissions"
            :key="perm.value"
            style="margin-bottom: 8px"
          >
            <el-checkbox :label="perm.value">{{ perm.label }}</el-checkbox>
          </div>
        </el-checkbox-group>

        <div style="margin-top: 24px">
          <el-button
            type="primary"
            @click="onSavePermissions"
            style="width: 100%"
          >
            保存权限
          </el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { ElMessage } from "element-plus";
import request from "@/utils/axios";
const members = ref<any[]>([]);
const total = ref(0);
const permissionDrawer = ref(false);
const currentMember = ref<any>(null);
const selectedPermissions = ref<string[]>([]);

const filters = ref({
  department: "",
  position: "",
  name: "",
});

const availablePermissions = [
  { value: "vote", label: "投票表决" },
  { value: "survey", label: "问卷调查" },
  { value: "service_evaluation", label: "服务人员评价" },
  { value: "property_evaluation", label: "物业公司评价" },
  { value: "repair", label: "报修" },
  { value: "report", label: "报事" },
  { value: "announcement", label: "信息公示" },
  { value: "notification", label: "通知公告" },
];

const selectAll = computed({
  get: () => selectedPermissions.value.length === availablePermissions.length,
  set: (val) => {
    if (val) {
      selectedPermissions.value = availablePermissions.map((p) => p.value);
    } else {
      selectedPermissions.value = [];
    }
  },
});

function onSelectAllChange(val: boolean) {
  selectAll.value = val;
}

function getPermissionLabel(value: string) {
  const perm = availablePermissions.find((p) => p.value === value);
  return perm ? perm.label : value;
}

async function loadMembers() {
  try {
    const user = JSON.parse(localStorage.getItem("admin-user") || "{}");
    const communityId = user.communityId;

    if (!communityId) {
      ElMessage.error("未找到小区信息");
      return;
    }

    const body = await request.get("/community-admins", {
      params: {
        communityId,
        department: filters.value.department,
        position: filters.value.position,
        name: filters.value.name,
      },
    });

    members.value = body.data || [];
    total.value = body.total || 0;
  } catch (e) {
    console.error(e);
    ElMessage.error("加载成员列表失败");
  }
}

function openPermissionDrawer(row: any) {
  currentMember.value = row;
  selectedPermissions.value = row.permissions || [];
  permissionDrawer.value = true;
}

async function onSavePermissions() {
  if (!currentMember.value) return;

  try {
    await request.put(
      `/community-admins/${currentMember.value._id}/permissions`,
      {
        permissions: selectedPermissions.value,
      }
    );

    ElMessage.success("权限已更新");
    permissionDrawer.value = false;
    loadMembers();
  } catch (e) {
    console.error(e);
    ElMessage.error("保存失败");
  }
}

function applyFilters() {
  loadMembers();
}

function resetFilters() {
  filters.value = { department: "", position: "", name: "" };
  loadMembers();
}

onMounted(() => {
  loadMembers();
});
</script>

<style scoped>
.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
</style>
