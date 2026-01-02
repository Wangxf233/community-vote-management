import axios from "axios";
import { ElMessage } from "element-plus";

// 创建axios实例
const instance = axios.create({
  // 开发环境使用相对路径（由 Vite proxy 代理到 localhost:3000）
  // 生产环境使用云托管完整域名
  baseURL: import.meta.env.PROD
    ? "https://admin-213370-7-1325504194.sh.run.tcloudbase.com/api" // 生产环境：云托管域名/api
    : "/api", // 开发环境：相对路径，由 Vite proxy 处理
  timeout: 30000,
});

// 请求拦截器
instance.interceptors.request.use(
  (config) => {
    // 从localStorage获取token（兼容两种键名）
    const token =
      localStorage.getItem("admin-token") || localStorage.getItem("adminToken");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
instance.interceptors.response.use(
  (response) => {
    // 直接返回 response.data，简化调用
    return response.data;
  },
  (error) => {
    // 处理错误响应
    if (error.response) {
      const { status, data } = error.response;

      // 401 自动跳转登录
      if (status === 401) {
        const currentPath = window.location.hash;
        if (!currentPath.includes("/login")) {
          ElMessage.error("登录已过期，请重新登录");
          localStorage.removeItem("adminToken");
          localStorage.removeItem("admin-user");
          localStorage.removeItem("admin-token");
          setTimeout(() => {
            window.location.href = "/#/login";
          }, 1000);
        }
      } else {
        // 显示错误信息
        const errorMsg = data?.error || data?.message || "请求失败";
        ElMessage.error(errorMsg);
      }
    } else if (error.request) {
      ElMessage.error("网络错误，请检查连接");
    } else {
      ElMessage.error(error.message || "请求失败");
    }

    return Promise.reject(error);
  }
);

export default instance;
