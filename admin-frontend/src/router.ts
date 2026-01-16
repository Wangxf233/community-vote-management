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

export default router;
