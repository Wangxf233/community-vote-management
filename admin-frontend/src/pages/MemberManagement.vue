<template>
  <div
    style="
      height: calc(100vh - 96px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    "
  >
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
        <el-form-item label="手机号" style="margin-bottom: 0">
          <el-input v-model="filters.phone" placeholder="手机号" />
        </el-form-item>
        <el-form-item label="账号" style="margin-bottom: 0">
          <el-input v-model="filters.username" placeholder="账号" />
        </el-form-item>
        <el-form-item style="margin-bottom: 0">
          <el-button type="primary" @click="onQuery">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

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
          <span style="font-weight: 600">成员管理</span>
          <span style="margin-left: 12px; color: #999">共 {{ total }} 人</span>
        </div>
        <el-button type="primary" @click="openAddDialog">添加成员</el-button>
      </div>

      <div style="flex: 1; width: 100%; overflow: hidden">
        <el-table :data="members" stripe style="width: 100%" height="100%">
          <el-table-column
            label="所属部门"
            prop="department"
            min-width="100"
            align="center"
          />
          <el-table-column
            label="职位"
            prop="position"
            min-width="100"
            align="center"
          />
          <el-table-column
            label="姓名"
            prop="name"
            min-width="100"
            align="center"
          />
          <el-table-column
            label="手机号"
            prop="phone"
            min-width="120"
            align="center"
          />
          <el-table-column
            label="账号"
            prop="username"
            min-width="120"
            align="center"
          />
          <el-table-column label="创建时间" min-width="150" align="center">
            <template #default="{ row }">
              {{ formatDate(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="280" align="center">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="onViewAccount(row)"
                >查看账号</el-button
              >
              <el-button type="warning" size="small" @click="onEdit(row)"
                >编辑</el-button
              >
              <el-button type="danger" size="small" @click="onDelete(row)"
                >删除</el-button
              >
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <!-- 添加成员弹窗 -->
    <el-dialog v-model="addDialog" title="添加成员" width="520px">
      <el-form :model="addForm" label-width="100px">
        <el-form-item label="所属部门">
          <el-select
            v-model="addForm.department"
            placeholder="请选择所属部门"
            style="width: 100%"
          >
            <el-option label="业委会" value="业委会" />
            <el-option label="物业公司" value="物业公司" />
          </el-select>
        </el-form-item>
        <el-form-item label="职位">
          <el-input v-model="addForm.position" placeholder="如：物业经理" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="addForm.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="addForm.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="账号">
          <el-input v-model="addForm.username" placeholder="登录账号" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="addForm.password"
            type="password"
            placeholder="初始密码"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialog = false">取消</el-button>
        <el-button type="primary" @click="onAddMember">保存</el-button>
      </template>
    </el-dialog>

    <!-- 编辑成员弹窗 -->
    <el-dialog v-model="editDialog" title="编辑成员" width="520px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="所属部门">
          <el-select
            v-model="editForm.department"
            placeholder="请选择所属部门"
            style="width: 100%"
          >
            <el-option label="业委会" value="业委会" />
            <el-option label="物业公司" value="物业公司" />
          </el-select>
        </el-form-item>
        <el-form-item label="职位">
          <el-input v-model="editForm.position" placeholder="如：物业经理" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="editForm.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="editForm.phone" placeholder="请输入手机号" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialog = false">取消</el-button>
        <el-button type="primary" @click="onSaveEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 查看账号弹窗 -->
    <el-dialog v-model="accountDialog" title="账号信息" width="520px">
      <el-form :model="accountForm" label-width="100px">
        <el-form-item label="账号">
          <el-input v-model="accountForm.username" />
        </el-form-item>
        <el-form-item label="密码">
          <template v-if="tempNewPassword">
            <el-input :value="tempNewPassword" readonly />
            <div style="color: #f56c6c; font-size: 12px; margin-top: 4px">
              请保存密码，只允许查看一次。
            </div>
          </template>
          <template v-else>
            <el-input value="********" disabled />
            <div style="color: #999; font-size: 12px; margin-top: 4px">
              出于安全考虑，当前密码不可见。
            </div>
          </template>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="warning" @click="onResetPassword">重置密码</el-button>
        <el-button type="primary" @click="onSaveAccount">保存账号</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import request from "@/utils/axios";
const members = ref<any[]>([]);
const total = ref(0);
const addDialog = ref(false);
const editDialog = ref(false);
const accountDialog = ref(false);
const tempNewPassword = ref<string | null>(null);
let currentMemberId: string | null = null;
let editingMemberId: string | null = null;

const filters = reactive({
  department: "",
  position: "",
  name: "",
  phone: "",
  username: "",
});

const addForm = reactive({
  department: "",
  position: "",
  name: "",
  phone: "",
  username: "",
  password: "",
});

const editForm = reactive({
  department: "",
  position: "",
  name: "",
  phone: "",
});

const accountForm = reactive({
  department: "",
  position: "",
  name: "",
  phone: "",
  username: "",
});

function formatDate(val: any) {
  if (!val) return "";
  try {
    const d = new Date(val);
    return d.toLocaleString("zh-CN");
  } catch {
    return "";
  }
}

async function loadMembers() {
  try {
    const user = JSON.parse(localStorage.getItem("admin-user") || "{}");
    const communityId = user.communityId;

    if (!communityId) {
      ElMessage.error("未找到小区信息");
      return;
    }

    const params: any = { communityId };
    if (filters.department) params.department = filters.department;
    if (filters.position) params.position = filters.position;
    if (filters.name) params.name = filters.name;
    if (filters.phone) params.phone = filters.phone;
    if (filters.username) params.username = filters.username;

    const body: any = await request.get("/community-admins", { params });

    members.value = body.data || [];
    total.value = body.total || 0;
  } catch (e) {
    console.error(e);
    ElMessage.error("加载成员列表失败");
  }
}

function onQuery() {
  loadMembers();
}

function onReset() {
  filters.department = "";
  filters.position = "";
  filters.name = "";
  filters.phone = "";
  filters.username = "";
  loadMembers();
}

function openAddDialog() {
  addForm.department = "";
  addForm.position = "";
  addForm.name = "";
  addForm.phone = "";
  addForm.username = "";
  addForm.password = "";
  addDialog.value = true;
}

async function onAddMember() {
  if (
    !addForm.name ||
    !addForm.phone ||
    !addForm.username ||
    !addForm.password
  ) {
    ElMessage.warning("请填写完整信息");
    return;
  }

  try {
    const user = JSON.parse(localStorage.getItem("admin-user") || "{}");
    const communityId = user.communityId;

    await request.post("/community-admins", {
      communityId,
      ...addForm,
    });

    ElMessage.success("添加成功");
    addDialog.value = false;
    loadMembers();
  } catch (e: any) {
    console.error(e);
    const backendErr = e?.response?.data?.error;
    ElMessage.error(backendErr || "添加失败");
  }
}

function onEdit(row: any) {
  editingMemberId = row._id;
  editForm.department = row.department || "";
  editForm.position = row.position || "";
  editForm.name = row.name || "";
  editForm.phone = row.phone || "";
  editDialog.value = true;
}

async function onSaveEdit() {
  if (!editingMemberId) return;
  if (!editForm.name || !editForm.phone) {
    ElMessage.warning("请填写姓名和手机号");
    return;
  }

  try {
    await request.put(`/community-admins/${editingMemberId}`, {
      department: editForm.department,
      position: editForm.position,
      name: editForm.name,
      phone: editForm.phone,
    });

    ElMessage.success("保存成功");
    editDialog.value = false;
    loadMembers();
  } catch (e) {
    console.error(e);
    ElMessage.error("保存失败");
  }
}

async function onViewAccount(row: any) {
  try {
    currentMemberId = row._id;

    const body: any = await request.get(`/community-admins/${row._id}/account`);

    accountForm.department = body.department || "";
    accountForm.position = body.position || "";
    accountForm.name = body.name || "";
    accountForm.phone = body.phone || "";
    accountForm.username = body.username || "";
    tempNewPassword.value = null;
    accountDialog.value = true;
  } catch (e) {
    console.error(e);
    ElMessage.error("加载失败");
  }
}

async function onSaveAccount() {
  if (!currentMemberId) return;
  if (!accountForm.username) {
    ElMessage.warning("请填写账号");
    return;
  }

  try {
    const body: any = await request.put(
      `/community-admins/${currentMemberId}/account`,
      {
        username: accountForm.username.trim(),
        ...(tempNewPassword.value
          ? { newPassword: tempNewPassword.value }
          : {}),
      },
    );

    if (body.newPassword) {
      tempNewPassword.value = body.newPassword;
    }

    ElMessage.success("账号/密码已保存");
    loadMembers();
  } catch (e) {
    console.error(e);
    ElMessage.error("保存失败");
  }
}

async function onResetPassword() {
  if (!currentMemberId) return;

  try {
    await ElMessageBox.confirm(
      "将为该成员生成一个新密码。本次重置后无需强制修改密码。是否继续？",
      "重置密码确认",
      { type: "warning" },
    );
  } catch {
    return;
  }

  try {
    const gen8Digit = () =>
      String(Math.floor(10000000 + Math.random() * 90000000));
    const nextPwd = gen8Digit();

    const body: any = await request.put(
      `/community-admins/${currentMemberId}/account`,
      {
        ...(accountForm.username
          ? { username: accountForm.username.trim() }
          : {}),
        reset: true,
        newPassword: nextPwd,
      },
    );

    tempNewPassword.value = body.newPassword || nextPwd;
    ElMessage.success("密码已重置，请及时保存");
    loadMembers();
  } catch (e) {
    console.error(e);
    ElMessage.error("重置失败");
  }
}

async function onDelete(row: any) {
  try {
    await ElMessageBox.confirm(
      `确认删除成员「${row.name}」？此操作不可撤销。`,
      "删除确认",
      {
        type: "warning",
        confirmButtonText: "确认删除",
        cancelButtonText: "取消",
      },
    );
  } catch {
    return;
  }

  try {
    await request.delete(`/community-admins/${row._id}`);

    ElMessage.success("删除成功");
    loadMembers();
  } catch (e) {
    console.error(e);
    ElMessage.error("删除失败");
  }
}

onMounted(() => {
  loadMembers();
});
</script>

<style scoped>
.filter-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
</style>
