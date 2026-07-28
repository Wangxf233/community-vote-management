import { createRouter, createWebHashHistory } from "vue-router";

const routes = [
  { path: "/", redirect: "/login" },
  {
    path: "/login",
    component: () => import("./pages/Login.vue"),
  },
  {
    path: "/admin",
    component: () => import("./layouts/AdminLayout.vue"),
    children: [
      { path: "", redirect: "/admin/list" },
      {
        path: "add",
        component: () => import("./pages/AddCommunity.vue"),
      },
      {
        path: "list",
        component: () => import("./pages/CommunityList.vue"),
      },
      {
        path: "door",
        component: () => import("./pages/SuperAdminDoor.vue"),
      },
      {
        path: "door/devices/create",
        component: () => import("./pages/DoorManagementCreate.vue"),
        props: (route) => ({
          communityId: route.query.communityId || undefined,
        }),
      },
    ],
  },
  {
    path: "/community-admin",
    component: () => import("./layouts/CommunityAdminLayout.vue"),
    children: [
      { path: "", redirect: "/community-admin/house-config" },
      {
        path: "community-info",
        component: () => import("./pages/CommunityInfo.vue"),
      },
      {
        path: "house-config",
        component: () => import("./pages/HouseConfig.vue"),
      },
      {
        path: "owner-registry",
        component: () => import("./pages/OwnerRegistry.vue"),
      },
      {
        path: "certification-review",
        component: () => import("./pages/CertificationReview.vue"),
      },
      {
        path: "owner-list",
        component: () => import("./pages/OwnerList.vue"),
      },
      {
        path: "members",
        component: () => import("./pages/MemberManagement.vue"),
      },
      {
        path: "permissions",
        component: () => import("./pages/PermissionManagement.vue"),
      },
      {
        path: "votes",
        component: () => import("./pages/VoteManagement.vue"),
      },
      {
        path: "votes/:id",
        name: "VoteDetail",
        component: () => import("./pages/VoteDetail.vue"),
      },
      {
        path: "votes/add",
        component: () => import("./pages/AddVote.vue"),
      },
      {
        path: "evaluations",
        component: () => import("./pages/EvaluationsManagement/index.vue"),
        props: { title: "评价管理" },
      },
      {
        path: "repairs",
        component: () => import("./pages/RepairManagement.vue"),
      },
      {
        path: "door-management",
        component: () => import("./pages/DoorManagement.vue"),
      },
      {
        path: "door-management/create",
        component: () => import("./pages/DoorManagementCreate.vue"),
      },
      {
        path: "door-permissions",
        component: () => import("./pages/DoorPermissionManagement.vue"),
      },
      {
        path: "announcements",
        component: () => import("./pages/AnnouncementManagement/index.vue"),
      },
      {
        path: "announcement-form",
        component: () =>
          import("./pages/AnnouncementManagement/AnnouncementForm.vue"),
      },
      {
        path: "notifications",
        component: () => import("./pages/NotificationManagement.vue"),
      },
      {
        path: "vehicles",
        component: () => import("./pages/VehicleManagement.vue"),
      },
      {
        path: "staff",
        component: () => import("./pages/StaffManagement.vue"),
      },
      {
        path: "notification-form",
        component: () => import("./pages/NotificationForm.vue"),
      },
    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// 路由守卫：权限验证
router.beforeEach((to, from, next) => {
  // 登录页直接放行
  if (to.path === "/login") {
    next();
    return;
  }

  // 检查是否已登录
  const token = localStorage.getItem("admin-token");
  if (!token) {
    next("/login");
    return;
  }

  // 获取用户信息
  const userStr = localStorage.getItem("admin-user");
  if (!userStr) {
    next("/login");
    return;
  }

  try {
    const user = JSON.parse(userStr);
    const userRole = user.role;

    // 超级管理员可以访问所有页面
    if (userRole === "super") {
      next();
      return;
    }

    // 小区管理员只能访问 /community-admin 路径
    if (userRole === "community" || userRole === "community_admin") {
      if (to.path.startsWith("/community-admin")) {
        next();
      } else {
        // 尝试访问超级管理员页面，拦截并跳转
        console.warn("权限不足：小区管理员无法访问超级管理员页面");
        next("/community-admin");
      }
      return;
    }

    // 其他未知角色，跳转到登录
    console.warn("未知角色:", userRole);
    next("/login");
  } catch (error) {
    console.error("解析用户信息失败:", error);
    next("/login");
  }
});

export default router;
