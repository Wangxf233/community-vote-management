import axios from "axios";
import { ElMessage } from "element-plus";

// 创建axios实例
const instance = axios.create({
  baseURL: "http://localhost:3000/api",
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
    return response;
  },
  (error) => {
    // 不自动处理错误，让调用方处理
    // 只在特定情况下显示通用错误信息
    if (error.response) {
      const { status } = error.response;

      // 只处理401自动跳转登录
      if (status === 401) {
        const currentPath = window.location.hash;
        // 如果已经在登录页，不重复跳转
        if (!currentPath.includes("/login")) {
          ElMessage.error("登录已过期，请重新登录");
          localStorage.removeItem("adminToken");
          localStorage.removeItem("admin-user");
          localStorage.removeItem("admin-token");
          // 跳转到登录页
          setTimeout(() => {
            window.location.href = "/#/login";
          }, 1000);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default instance;
