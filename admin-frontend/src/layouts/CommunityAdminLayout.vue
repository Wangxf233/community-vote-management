<template>
  <div class="community-admin-layout">
    <el-container style="height: 100vh">
      <el-aside width="200px" class="aside">
        <div class="logo">{{ communityName || "小区" }}管理后台</div>
        <el-menu
          :default-active="active"
          class="el-menu-vertical-demo"
          @select="onSelect"
          :default-openeds="['certification', 'backend-admin']"
        >
          <el-sub-menu v-if="isPrimaryAdmin" index="backend-admin">
            <template #title>
              <el-icon><Setting /></el-icon>
              <span>后台成员管理</span>
            </template>
            <el-menu-item index="/community-admin/members">
              <el-icon><UserFilled /></el-icon>
              <span>成员管理</span>
            </el-menu-item>
            <el-menu-item index="/community-admin/permissions">
              <el-icon><Lock /></el-icon>
              <span>权限管理</span>
            </el-menu-item>
          </el-sub-menu>
          <el-sub-menu index="certification">
            <template #title>
              <el-icon><Document /></el-icon>
              <span>认证中心</span>
            </template>
            <el-menu-item index="/community-admin/house-config">
              <el-icon><OfficeBuilding /></el-icon>
              <span>房屋配置</span>
            </el-menu-item>
            <el-menu-item index="/community-admin/owner-registry">
              <el-icon><Notebook /></el-icon>
              <span>业主名册</span>
            </el-menu-item>
            <el-menu-item index="/community-admin/certification-review">
              <el-icon><CircleCheck /></el-icon>
              <span>认证审核</span>
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item index="/community-admin/owner-list">
            <el-icon><Checked /></el-icon>
            <span>户主名单</span>
          </el-menu-item>
          <el-menu-item index="/community-admin/votes">
            <el-icon><TrendCharts /></el-icon>
            <span>投票管理</span>
          </el-menu-item>
          <el-menu-item index="/community-admin/evaluations">
            <el-icon><ChatLineSquare /></el-icon>
            <span>评价管理</span>
          </el-menu-item>
          <el-menu-item index="/community-admin/repairs">
            <el-icon><Tools /></el-icon>
            <span>报修管理</span>
          </el-menu-item>
          <el-menu-item
            v-if="isPrimaryAdmin || hasPermission('announcement')"
            index="/community-admin/announcements"
          >
            <el-icon><Bell /></el-icon>
            <span>信息公示</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-container>
        <el-header class="topbar">
          <div class="left">{{ communityName || "小区管理" }}</div>
          <div class="right">
            <el-tooltip content="刷新" placement="bottom">
              <el-button text circle @click="refresh">
                <el-icon><Refresh /></el-icon>
              </el-button>
            </el-tooltip>

            <el-tooltip
              :content="isDark ? '切换到日间模式' : '切换到夜间模式'"
              placement="bottom"
            >
              <el-button text circle @click="toggleDark">
                <el-icon v-if="!isDark"><Moon /></el-icon>
                <el-icon v-else><Sunny /></el-icon>
              </el-button>
            </el-tooltip>

            <el-popover placement="bottom-end" trigger="hover" width="240">
              <template #reference>
                <el-button text circle>
                  <el-icon><User /></el-icon>
                </el-button>
              </template>
              <div class="profile-pop">
                <div class="row">
                  <span class="label">姓名</span>
                  <span class="val">{{ userName || "-" }}</span>
                </div>
                <div class="row">
                  <span class="label">账号</span>
                  <span class="val">{{ username || "-" }}</span>
                </div>
                <div class="row">
                  <span class="label">角色</span>
                  <span class="val">{{
                    isPrimaryAdmin ? "总管理员" : "普通管理员"
                  }}</span>
                </div>
                <div class="footer">
                  <el-button size="small" type="danger" @click="logout"
                    >退出登录</el-button
                  >
                </div>
              </div>
            </el-popover>
          </div>
        </el-header>
        <el-main style="padding: 16px; overflow: hidden">
          <router-view />
        </el-main>
      </el-container>
    </el-container>

    <!-- 首次登录强制修改密码 -->
    <el-dialog
      v-model="pwdDialog"
      title="请修改初始密码"
      width="420px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
    >
      <el-form :model="pwdForm" label-width="120px">
        <el-form-item label="新密码">
          <el-input v-model="pwdForm.newPassword" type="password" />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input v-model="pwdForm.confirm" type="password" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="submitPwd">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import request from "../utils/axios";
import {
  Refresh,
  Moon,
  Sunny,
  User,
  Setting,
  UserFilled,
  Lock,
  Document,
  OfficeBuilding,
  Notebook,
  CircleCheck,
  Checked,
  TrendCharts,
  ChatLineSquare,
  Tools,
  Bell,
} from "@element-plus/icons-vue";
const router = useRouter();
const route = useRoute();
const active = computed(() => route.path);

function onSelect(path: string) {
  router.push(path);
}

const isDark = ref(false);
const username = ref("");
const userName = ref("");
const communityName = ref("");
const isPrimaryAdmin = ref(false);

function applyDark(v: boolean) {
  const root = document.documentElement;
  if (v) root.classList.add("dark");
  else root.classList.remove("dark");
  localStorage.setItem("admin-dark", v ? "1" : "0");
  isDark.value = v;
}

function toggleDark() {
  applyDark(!isDark.value);
}

async function loadCommunityInfo() {
  try {
    const token = localStorage.getItem("admin-token") || "";
    if (!token) return;

    // 从服务器获取最新的用户信息（包含 communityId）
    const userData = await request.get("/me");

    if (!userData.user) return;

    const user = userData.user;
    const communityId = user.communityId;

    // 更新本地存储的用户信息
    const raw = localStorage.getItem("admin-user");
    if (raw) {
      const localUser = JSON.parse(raw);
      const updatedUser = { ...localUser, ...user };
      localStorage.setItem("admin-user", JSON.stringify(updatedUser));
    }

    if (!communityId) return;

    // 根据 communityId 获取小区名称
    const body = await request.get("/communities", {
      params: { page: 1, pageSize: 1000 },
    });

    const communities = body.data || body || [];
    const myCommunity = communities.find((c: any) => c._id === communityId);

    if (myCommunity && myCommunity.name) {
      communityName.value = myCommunity.name;
    }
  } catch (e) {
    console.error("加载小区信息失败:", e);
  }
}
function initUser() {
  try {
    const raw = localStorage.getItem("admin-user");
    if (raw) {
      const u = JSON.parse(raw);
      username.value = u?.username || "";
      userName.value = u?.name || u?.username || "管理员";
      isPrimaryAdmin.value = u?.isPrimaryAdmin || false;
    }
  } catch {}
  applyDark(localStorage.getItem("admin-dark") === "1");
}

// 权限相关
const userPermissions = ref<string[]>([]);

function loadLocalPermissions() {
  try {
    const raw = localStorage.getItem("admin-user");
    if (raw) {
      const u = JSON.parse(raw);
      userPermissions.value = u?.permissions || [];
    }
  } catch (e) {
    console.error(e);
  }
}

function hasPermission(perm: string) {
  return isPrimaryAdmin.value || userPermissions.value.includes(perm);
}

function logout() {
  localStorage.removeItem("admin-token");
  localStorage.removeItem("admin-user");
  ElMessage.success("退出成功");
  router.push("/login");
}

function refresh() {
  location.reload();
}

// 强制修改密码
const pwdDialog = ref(false);
const pwdForm = reactive({ newPassword: "", confirm: "" });

async function submitPwd() {
  if (!pwdForm.newPassword || !pwdForm.confirm) {
    ElMessage.warning("请填写新密码并确认");
    return;
  }
  if (pwdForm.newPassword !== pwdForm.confirm) {
    ElMessage.error("两次输入的密码不一致");
    return;
  }
  try {
    const raw = localStorage.getItem("admin-user");
    const me = raw ? JSON.parse(raw) : null;
    const uid = me && me._id;
    if (!uid) {
      ElMessage.error("用户信息缺失，请重新登录");
      router.push("/login");
      return;
    }
    const token = localStorage.getItem("admin-token") || "";
    const body = await request.post(`/users/${uid}/change-password`, {
      newPassword: pwdForm.newPassword,
    });

    ElMessage.success("密码已更新，请牢记新密码");
    pwdDialog.value = false;
    pwdForm.newPassword = "";
    pwdForm.confirm = "";
  } catch (e) {
    console.error(e);
    ElMessage.error("修改失败，请稍后重试");
  }
}

onMounted(() => {
  initUser();
  loadCommunityInfo();
  loadLocalPermissions();
  // 强制修改密码
  if (sessionStorage.getItem("mustChangePassword") === "1") {
    sessionStorage.removeItem("mustChangePassword");
    pwdDialog.value = true;
  }
});
</script>

<style scoped>
.community-admin-layout {
  height: 100%;
  overflow: hidden;
}
.topbar {
  background: #fff;
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  justify-content: space-between;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
}
.topbar .left {
  font-weight: 600;
  font-size: 16px;
}
.topbar .right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.topbar .el-icon {
  font-size: 20px;
}
.profile-pop {
  font-size: 13px;
}
.profile-pop .row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}
.profile-pop .label {
  color: var(--el-text-color-secondary);
}
.profile-pop .footer {
  text-align: right;
  margin-top: 8px;
}
.aside {
  background: #001529;
  color: #fff;
}
.logo {
  height: 64px;
  line-height: 64px;
  color: #fff;
  text-align: center;
  font-weight: 600;
}
.el-menu-vertical-demo {
  background: transparent;
  color: #fff;
  border-right: none;
}
.el-menu-vertical-demo .el-menu-item {
  color: #fff !important;
}
.el-menu-vertical-demo .el-menu-item.is-active {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #1890ff !important;
}
/* 父菜单标题样式 */
.el-menu-vertical-demo :deep(.el-sub-menu__title) {
  color: #fff !important;
}
.el-menu-vertical-demo :deep(.el-sub-menu__title):hover {
  background: rgba(255, 255, 255, 0.05) !important;
}
/* 子菜单背景色 */
.el-menu-vertical-demo :deep(.el-menu) {
  background: rgba(0, 0, 0, 0.2) !important;
}
.el-menu-vertical-demo :deep(.el-menu .el-menu-item) {
  background: rgba(0, 0, 0, 0.2) !important;
  color: rgba(255, 255, 255, 0.85) !important;
}
.el-menu-vertical-demo :deep(.el-menu .el-menu-item):hover {
  background: rgba(255, 255, 255, 0.05) !important;
}
.el-menu-vertical-demo :deep(.el-menu .el-menu-item.is-active) {
  background: rgba(255, 255, 255, 0.1) !important;
  color: #1890ff !important;
}
</style>
