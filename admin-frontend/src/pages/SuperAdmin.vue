<template>
  <div class="super-admin">
    <el-row :gutter="20">
      <el-col :span="10">
        <el-card>
          <h3>添加已开通小区</h3>
          <el-form :model="form" label-width="100px">
            <el-form-item label="小区名称">
              <el-input v-model="form.name" />
            </el-form-item>
            <el-form-item label="地址">
              <el-input v-model="form.address" />
            </el-form-item>
            <el-form-item label="区域(逗号分隔)">
              <el-input v-model="form.regionText" placeholder="省,市,区" />
            </el-form-item>
            <el-form-item label="开通时间">
              <el-date-picker
                v-model="form.startDate"
                type="date"
                placeholder="开始日期"
              />
            </el-form-item>
            <el-form-item label="到期时间">
              <el-date-picker
                v-model="form.endDate"
                type="date"
                placeholder="结束日期"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="onCreate">创建小区</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="14">
        <el-card>
          <h3>已开通小区列表</h3>
          <el-table :data="communities" stripe style="width: 100%">
            <el-table-column prop="name" label="名称" />
            <el-table-column prop="address" label="地址" />
            <el-table-column prop="adminCount" label="管理员数" width="120" />
            <el-table-column
              prop="remainingDays"
              label="剩余有效天数"
              width="160"
            />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
const communities = ref<any[]>([]);
const form = reactive({
  name: "",
  address: "",
  regionText: "",
  startDate: null as any,
  endDate: null as any,
});

function getToken() {
  return localStorage.getItem("admin-token") || "";
}

async function loadList() {
  try {
    const token = getToken();
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch("/api/communities", { headers });
    if (!res.ok) throw new Error(await res.text());
    const body = await res.json();
    communities.value = body.data || body;
  } catch (e) {
    console.error("load communities failed", e);
    communities.value = [];
  }
}

async function onCreate() {
  if (!form.name) {
    ElMessage.warning("请输入小区名称");
    return;
  }
  const region = form.regionText
    ? form.regionText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const payload = {
    name: form.name,
    address: form.address,
    region,
    startDate: form.startDate
      ? new Date(form.startDate).toISOString()
      : undefined,
    endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
  };
  try {
    const token = getToken();
    const res = await fetch("/api/communities", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt);
    }
    const body = await res.json();
    if (body && body.success) {
      ElMessage.success("创建成功");
      // reset form and reload
      form.name = "";
      form.address = "";
      form.regionText = "";
      form.startDate = null;
      form.endDate = null;
      await loadList();
    } else {
      ElMessage.error("创建失败: " + JSON.stringify(body));
    }
  } catch (e: any) {
    console.error("create community failed", e);
    ElMessage.error("创建失败: " + (e.message || e));
  }
}

onMounted(loadList);
</script>

<style scoped>
.super-admin {
  padding: 16px;
}
.login-card {
  width: 100%;
}
</style>
