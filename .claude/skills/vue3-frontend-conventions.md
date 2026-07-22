# vue3-frontend-conventions

Vue 3 + Element Plus + TypeScript 管理后台前端编码规范。适用于 `admin-frontend/` 下的所有开发工作。

## 一、强制性规则

### 1.1 组件语法
- **必须**使用 `<script setup lang="ts">` + Composition API
- **禁止**使用 Options API（`export default { data(), methods: {} }`）
- **必须**为所有 props 定义 TypeScript 类型
- **禁止**使用 `any` 类型，不确定时使用 `unknown` + 类型守卫

### 1.2 API 调用
- **必须**通过 `@/utils/axios` 的 request 实例调用后端 API
- **禁止**在组件中直接 `import axios` 或使用 `fetch`
- 错误处理参考 `error-handling` Skill

### 1.3 路由与状态
- 路由参数通过 `useRoute()` / `useRouter()` 获取
- **禁止**直接操作 `window.location` 或 `window.location.hash`
- 全局状态使用 Pinia store（`src/stores/`），禁止在组件间通过 `provide/inject` 跨层级传复杂数据

### 1.4 样式规范
- 使用 `<style scoped>`，需要穿透子组件时用 `:deep()`
- 使用 CSS 变量而非硬编码颜色值（Element Plus 变量已可用）
- **禁止**`!important`，通过增加选择器特异性解决优先级问题

## 二、Element Plus 规范

### 2.1 图标
- 从 `@element-plus/icons-vue` 按需导入，如 `import { User, Setting } from '@element-plus/icons-vue'`
- **禁止**全量注册图标组件

### 2.2 表单校验
- 使用 `el-form` 的 `rules` prop + `ref` 获取 `FormInstance` 调用 `.validate()`
- 每个 `el-form-item` 必须有 `prop` 属性对应规则字段
- 自定义校验器放入 `src/utils/validators.ts`

### 2.3 表格与分页
- 列表页统一使用 `el-table` + `el-pagination`
- 分页参数：`{ page: number, pageSize: number }` → 后端返回 `{ data: T[], total: number }`

## 三、组件拆分

- 单个 SFC 不超过 **300 行**，超过则必须提取子组件
- 提取的 UI 组件放在 `src/components/`，页面级子组件放在页面同级目录
- 可复用逻辑提取为 Composable：`src/composables/use*.ts`

## 四、TypeScript 规范

- 类型定义集中放在 `src/types/` 下
- 组件 props 优先使用 `interface` 声明，通过 `defineProps<MyProps>()` 传入
- API 响应类型从 `shared/types.ts` 导入（Stage 2 后可用）：`import type { Vote, Repair } from '@shared/types'`

## 五、隐私数据展示红线 🔴

- 手机号：`phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')` → `138****1234`
- 身份证号：`idCard.replace(/(\d{4})\d{10}(\d{4})/, '$1**********$2')` → `3301**********1234`
- 姓名：`name[0] + '**'` → `张**`（二字名）或 `name[0] + '***'`（三字名）
- **必须**使用 `src/utils/privacy.ts` 中的工具函数，**禁止**在各组件中手写正则

## 六、禁止事项

- 禁止在 `<template>` 中写复杂计算逻辑（用 `computed`）
- 禁止在组件中修改 props
- 禁止使用 `v-html` 渲染用户输入内容（XSS 风险）
- 禁止在 `onMounted` 中不处理异步错误（必须 try-catch）
