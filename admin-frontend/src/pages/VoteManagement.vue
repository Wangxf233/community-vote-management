<template>
  <div
    style="
      height: calc(100vh - 96px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    "
  >
    <!-- 权限检查 -->
    <el-card v-if="!hasAnyPermission" style="text-align: center; padding: 40px">
      <el-empty description="暂无权限" />
    </el-card>

    <template v-else>
      <!-- 选项卡切换 -->
      <el-card style="margin-bottom: 12px; flex-shrink: 0">
        <div style="display: flex; align-items: center; justify-content: space-between">
          <el-radio-group v-model="activeTab" @change="onTabChange">
            <el-radio-button v-if="hasPermission('vote')" label="vote"
              >投票表决</el-radio-button
            >
            <el-radio-button v-if="hasPermission('survey')" label="survey"
              >问卷调查</el-radio-button
            >
          </el-radio-group>
          <div style="display: flex; align-items: center; gap: 8px">
            <span style="font-size: 13px; color: #909399">实名认证</span>
            <el-switch
              v-model="realNameRequired"
              :loading="realNameLoading"
              @change="onRealNameToggle"
            />
            <el-tooltip content="开启后，小程序用户必须完成实名认证才能使用投票和评价功能；关闭后用户可直接使用，无需实名认证" placement="bottom">
              <el-icon style="color: #909399; cursor: help"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
        </div>
      </el-card>

      <!-- 筛选条件 -->
      <el-card style="margin-bottom: 12px; flex-shrink: 0">
        <el-form :inline="true" :model="filters" class="filter-form">
          <el-form-item label="标题" style="margin-bottom: 0">
            <el-input v-model="filters.title" placeholder="标题" />
          </el-form-item>
          <el-form-item label="发起人" style="margin-bottom: 0">
            <el-select
              v-model="filters.initiator"
              placeholder="发起人"
              style="width: 120px"
            >
              <el-option label="全部" value="" />
              <el-option label="业委会" value="业委会" />
              <el-option label="物业公司" value="物业公司" />
            </el-select>
          </el-form-item>
          <el-form-item label="发布时间" style="margin-bottom: 0">
            <el-date-picker
              v-model="filters.publishTime"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
          <el-form-item label="截止时间" style="margin-bottom: 0">
            <el-date-picker
              v-model="filters.deadlineTime"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
          <el-form-item style="margin-bottom: 0">
            <el-button type="primary" @click="onQuery">查询</el-button>
            <el-button @click="onReset">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 列表 -->
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
            <span style="font-weight: 600">{{
              activeTab === "vote" ? "投票表决" : "问卷调查"
            }}</span>
            <span style="margin-left: 12px; color: #999"
              >共 {{ total }} 条</span
            >
          </div>
          <el-button type="primary" @click="onAdd">{{
            activeTab === "vote" ? "添加投票" : "添加问卷调查"
          }}</el-button>
        </div>

        <div style="flex: 1; width: 100%; overflow: hidden">
          <el-table :data="list" stripe style="width: 100%" height="100%">
            <el-table-column
              label="标题"
              min-width="150"
              align="center"
              prop="title"
            />
            <el-table-column label="详情" min-width="200" align="center">
              <template #default="{ row }">
                <el-tooltip :content="row.detail" placement="top">
                  <span class="text-ellipsis">{{ row.detail }}</span>
                </el-tooltip>
              </template>
            </el-table-column>
            <el-table-column label="附件" min-width="120" align="center">
              <template #default="{ row }">
                <el-link
                  v-if="row.attachment"
                  type="primary"
                  @click="downloadAttachment(row.attachment)"
                >
                  {{ row.attachmentName || "附件" }}
                </el-link>
                <span v-else style="color: #999">无</span>
              </template>
            </el-table-column>
            <el-table-column
              label="发起人"
              width="100"
              align="center"
              prop="initiator"
            />
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row)">
                  {{ getStatusText(row) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="发布时间" width="160" align="center">
              <template #default="{ row }">
                {{ formatDateTime(row.publishTime) }}
              </template>
            </el-table-column>
            <el-table-column label="截止时间" width="160" align="center">
              <template #default="{ row }">
                {{ formatDateTime(row.deadlineTime) }}
              </template>
            </el-table-column>
            <el-table-column label="投票说明" min-width="150" align="center">
              <template #default="{ row }">
                <el-tooltip :content="row.description" placement="top">
                  <span class="text-ellipsis">{{ row.description }}</span>
                </el-tooltip>
              </template>
            </el-table-column>
            <el-table-column
              label="操作"
              width="280"
              align="center"
              fixed="right"
            >
              <template #default="{ row }">
                <el-button type="info" size="small" @click="viewVoteDetail(row)"
                  >投票详情</el-button
                >
                <el-button
                  type="primary"
                  size="small"
                  @click="showStatistics(row)"
                  >数据统计</el-button
                >
                <el-button type="success" size="small" @click="manageVote(row)"
                  >投票管理</el-button
                >
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-card>
    </template>

    <!-- 数据统计弹窗 -->
    <el-dialog v-model="statisticsDialog" title="数据统计" width="600px">
      <div v-if="currentItem">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="总人数">{{
            statistics.totalCount
          }}</el-descriptions-item>
          <el-descriptions-item label="参与人数">
            {{ statistics.participantCount }} ({{
              statistics.participantRatio
            }}%)
          </el-descriptions-item>
          <el-descriptions-item label="同意人数">
            {{ statistics.agreeCount }} ({{ statistics.agreePercent }}%)
          </el-descriptions-item>
          <el-descriptions-item label="不同意人数">
            {{ statistics.disagreeCount }} ({{ statistics.disagreePercent }}%)
          </el-descriptions-item>
          <el-descriptions-item label="弃权人数">
            {{ statistics.abstainCount }} ({{ statistics.abstainPercent }}%)
          </el-descriptions-item>
        </el-descriptions>

        <el-divider v-if="activeTab === 'vote'" />

        <el-descriptions v-if="activeTab === 'vote'" :column="2" border>
          <el-descriptions-item label="总专有面积">
            {{ statistics.totalArea }}㎡
          </el-descriptions-item>
          <el-descriptions-item label="参与专有面积">
            {{ statistics.participantArea }}㎡ ({{
              statistics.participantAreaRatio
            }}%)
          </el-descriptions-item>
          <el-descriptions-item label="同意专有面积">
            {{ statistics.agreeArea }}㎡ ({{ statistics.agreeAreaPercent }}%)
          </el-descriptions-item>
          <el-descriptions-item label="不同意专有面积">
            {{ statistics.disagreeArea }}㎡ ({{
              statistics.disagreeAreaPercent
            }}%)
          </el-descriptions-item>
          <el-descriptions-item label="弃权专有面积">
            {{ statistics.abstainArea }}㎡ ({{
              statistics.abstainAreaPercent
            }}%)
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>

    <!-- 投票管理弹窗 -->
    <el-dialog v-model="manageDialog" title="投票管理" width="500px">
      <el-form label-width="140px">
        <el-form-item label="当前状态">
          <el-tag
            :type="currentItem?.status === 'paused' ? 'warning' : 'success'"
          >
            {{ currentItem?.status === "paused" ? "已暂停" : "进行中" }}
          </el-tag>
        </el-form-item>
        <el-form-item label="截止时间">
          <el-date-picker
            v-model="newDeadline"
            type="datetime"
            placeholder="选择截止时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="小程序结果展示">
          <el-switch v-model="showResultSwitch" />
          <div style="color: #999; font-size: 12px; margin-top: 8px">
            开启后，在小程序页投票完将显示同意、不同意、弃权人数及比例
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button
          v-if="currentItem?.status !== 'paused'"
          type="warning"
          @click="pauseVote"
          >暂停投票</el-button
        >
        <el-button v-else type="success" @click="resumeVote"
          >恢复投票</el-button
        >
        <el-button type="primary" @click="saveVoteSettings">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { QuestionFilled } from "@element-plus/icons-vue";
import request from "@/utils/axios";

const router = useRouter();
const route = useRoute();
const activeTab = ref<"vote" | "survey">(
  (route.query.type as "vote" | "survey") || "vote"
);
const list = ref<any[]>([]);
const total = ref(0);
const statisticsDialog = ref(false);
const manageDialog = ref(false);
const currentItem = ref<any>(null);
const newDeadline = ref<Date | null>(null);
const showResultSwitch = ref(false);

const filters = reactive({
  title: "",
  initiator: "",
  publishTime: [] as any[],
  deadlineTime: [] as any[],
});

const statistics = reactive({
  totalCount: 0,
  participantCount: 0,
  participantRatio: 0,
  agreeCount: 0,
  disagreeCount: 0,
  abstainCount: 0,
  agreePercent: 0,
  disagreePercent: 0,
  abstainPercent: 0,
  totalArea: 0,
  participantArea: 0,
  participantAreaRatio: 0,
  agreeArea: 0,
  disagreeArea: 0,
  abstainArea: 0,
  agreeAreaPercent: 0,
  disagreeAreaPercent: 0,
  abstainAreaPercent: 0,
});

// 权限检查
const userPermissions = ref<string[]>([]);
const userRole = ref<string>("");

function hasPermission(perm: string): boolean {
  // 总管理员拥有所有权限
  if (userRole.value === "super" || userRole.value === "admin") {
    return true;
  }
  return userPermissions.value.includes(perm);
}

const hasAnyPermission = computed(() => {
  return hasPermission("vote") || hasPermission("survey");
});

function loadPermissions() {
  try {
    const raw = localStorage.getItem("admin-user");
    if (raw) {
      const user = JSON.parse(raw);
      userRole.value = user.role || "";
      userPermissions.value = user.permissions || [];
      // 根据权限设置默认tab
      if (!hasPermission("vote") && hasPermission("survey")) {
        activeTab.value = "survey";
      }
    }
  } catch (e) {
    console.error(e);
  }
}

function formatDateTime(val: any) {
  if (!val) return "";
  try {
    const d = new Date(val);
    return d.toLocaleString("zh-CN");
  } catch {
    return "";
  }
}

function getStatusText(row: any) {
  if (row.status === "paused") return "暂停中";
  const now = new Date();
  const deadline = new Date(row.deadlineTime);
  if (now > deadline) return "已结束";
  return "进行中";
}

function getStatusType(row: any) {
  if (row.status === "paused") return "warning";
  const now = new Date();
  const deadline = new Date(row.deadlineTime);
  if (now > deadline) return "info";
  return "success";
}

async function loadList() {
  try {
    const user = JSON.parse(localStorage.getItem("admin-user") || "{}");
    const communityId = user.communityId;

    if (!communityId) {
      ElMessage.error("未找到小区信息");
      return;
    }

    const params: any = {
      communityId,
      type: activeTab.value,
    };

    if (filters.title) params.title = filters.title;
    if (filters.initiator) params.initiator = filters.initiator;
    if (filters.publishTime && filters.publishTime.length === 2) {
      params.publishTimeStart = new Date(filters.publishTime[0]).toISOString();
      params.publishTimeEnd = new Date(filters.publishTime[1]).toISOString();
    }
    if (filters.deadlineTime && filters.deadlineTime.length === 2) {
      params.deadlineTimeStart = new Date(
        filters.deadlineTime[0]
      ).toISOString();
      params.deadlineTimeEnd = new Date(filters.deadlineTime[1]).toISOString();
    }

    const body = await request.get("/votes", { params });

    list.value = body.data || [];
    total.value = body.total || 0;
  } catch (e) {
    console.error(e);
    ElMessage.error("加载列表失败");
  }
}

function onTabChange() {
  onReset();
}

function onQuery() {
  loadList();
}

function onReset() {
  filters.title = "";
  filters.initiator = "";
  filters.publishTime = [];
  filters.deadlineTime = [];
  loadList();
}

function onAdd() {
  router.push({
    path: "/community-admin/votes/add",
    query: { type: activeTab.value },
  });
}

function downloadAttachment(url: string) {
  window.open(url, "_blank");
}

async function showStatistics(row: any) {
  currentItem.value = row;
  try {
    const body = await request.get(`/votes/${row._id}/statistics`);

    Object.assign(statistics, body.data);
    statisticsDialog.value = true;
  } catch (e) {
    console.error(e);
    ElMessage.error("加载统计数据失败");
  }
}

function viewVoteDetail(row: any) {
  router.push({
    name: "VoteDetail",
    params: { id: row._id },
  });
}

function manageVote(row: any) {
  currentItem.value = row;
  newDeadline.value = row.deadlineTime ? new Date(row.deadlineTime) : null;
  showResultSwitch.value = row.showResult || false;
  manageDialog.value = true;
}

async function pauseVote() {
  try {
    await ElMessageBox.confirm("确认暂停当前投票？", "提示", {
      type: "warning",
    });

    await request.put(`/votes/${currentItem.value._id}/pause`);

    ElMessage.success("已暂停投票");
    manageDialog.value = false;
    loadList();
  } catch (e: any) {
    if (e !== "cancel") {
      console.error(e);
      ElMessage.error("操作失败");
    }
  }
}

async function resumeVote() {
  try {
    await request.put(`/votes/${currentItem.value._id}/resume`);

    ElMessage.success("已恢复投票");
    manageDialog.value = false;
    loadList();
  } catch (e) {
    console.error(e);
    ElMessage.error("操作失败");
  }
}

async function saveVoteSettings() {
  if (!newDeadline.value) {
    ElMessage.warning("请选择截止时间");
    return;
  }

  try {
    // 更新截止时间
    await request.put(`/votes/${currentItem.value._id}/deadline`, {
      deadlineTime: newDeadline.value.toISOString(),
    });

    // 更新结果展示
    await request.put(`/votes/${currentItem.value._id}/show-result`, {
      showResult: showResultSwitch.value,
    });

    ElMessage.success("保存成功");
    manageDialog.value = false;
    loadList();
  } catch (e) {
    ElMessage.error("操作失败");
  }
}

const realNameRequired = ref(true);
const realNameLoading = ref(false);

async function fetchRealNameSetting() {
  try {
    const user = JSON.parse(localStorage.getItem("admin-user") || "{}");
    const communityId = user.communityId;
    if (!communityId) return;
    const res: any = await request.get(`/communities/${communityId}/real-name-setting`);
    realNameRequired.value = res.requireRealName !== false;
  } catch (e) {
    console.error("获取实名认证开关失败:", e);
  }
}

async function onRealNameToggle(val: boolean) {
  if (!val) {
    try {
      await ElMessageBox.confirm(
        "关闭实名认证后，未实名的小程序用户也可以直接参与投票和评价。这可能导致投票过程不够规范，请确认是否继续？",
        "关闭实名认证",
        { confirmButtonText: "确认关闭", cancelButtonText: "取消", type: "warning" },
      );
    } catch {
      realNameRequired.value = true;
      return;
    }
  }
  realNameLoading.value = true;
  try {
    const user = JSON.parse(localStorage.getItem("admin-user") || "{}");
    const communityId = user.communityId;
    await request.put(`/communities/${communityId}/real-name-setting`, {
      requireRealName: val,
    });
    ElMessage.success(val ? "已开启实名认证" : "已关闭实名认证");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || "设置失败");
    realNameRequired.value = !val;
  } finally {
    realNameLoading.value = false;
  }
}

onMounted(() => {
  loadPermissions();
  if (hasAnyPermission.value) {
    loadList();
    fetchRealNameSetting();
  }
});

// 如果路由 query 中的 type 变化（比如从添加页返回），同步 activeTab 并重新加载列表
watch(
  () => route.query.type,
  (val) => {
    const t = (val as string) || "vote";
    if (t === "vote" || t === "survey") {
      activeTab.value = t as any;
      loadList();
    }
  }
);
</script>

<style scoped>
.filter-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.text-ellipsis {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
