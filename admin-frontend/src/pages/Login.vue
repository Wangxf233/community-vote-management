<template>
  <div class="login-modal">
    <el-card class="login-card-simple">
      <h3 style="text-align: center; margin-bottom: 12px">
        众议票评管理后台登录
      </h3>

      <el-form :model="form" @submit.native.prevent>
        <el-form-item>
          <el-input v-model="form.username" placeholder="用户名" />
        </el-form-item>
        <el-form-item>
          <el-input
            type="password"
            v-model="form.password"
            placeholder="请输入密码"
            show-password
          />
        </el-form-item>

        <el-form-item>
          <div style="text-align: center; width: 100%">
            <el-button type="primary" @click="onLogin">登录</el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import request from "@/utils/axios";

const router = useRouter();

const form = reactive({ username: "", password: "" });

async function onLogin() {
  if (!form.username || !form.password) {
    ElMessage.warning("请输入用户名和密码");
    return;
  }
  try {
    const body = await request.post("/login/password", {
      username: (form.username || "").trim(),
      password: form.password,
    });
    localStorage.setItem("admin-user", JSON.stringify(body.user));
    if (body.token) {
      localStorage.setItem("admin-token", body.token);
      sessionStorage.setItem("token", body.token);
    }
    sessionStorage.setItem("loginJust", "1");
    if (body.mustChangePassword)
      sessionStorage.setItem("mustChangePassword", "1");

    // 保存 communityId
    if (body.user?.communityId) {
      sessionStorage.setItem("communityId", body.user.communityId);
    }

    // 根据角色跳转到不同后台
    const role = body.user?.role;
    if (role === "super") {
      // 超级管理员
      router.push("/admin/list");
    } else if (role === "community" || role === "community_admin") {
      // 小区总管理员或普通管理员
      router.push("/community-admin");
    } else {
      // 默认跳转
      router.push("/admin/list");
    }
  } catch (e) {
    console.error(e);
    // 处理小区到期的特殊错误
    const err = e as any;
    if (err?.response?.data?.error === "community_expired") {
      ElMessage.error({
        message:
          err.response.data.message ||
          "该小区服务已到期，请尽快联系管理员续费以继续使用",
        duration: 5000,
      });
    } else {
      ElMessage.error("登录失败，用户名或密码错误");
    }
  }
}
</script>

<style scoped>
.login-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.login-card-simple {
  width: 420px;
  padding: 16px;
}
</style>
