import axios, {
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from "axios";
import { ElMessage } from "element-plus";

// 定义响应数据类型
interface ApiResponse<T = any> {
  data?: T;
  total?: number;
  [key: string]: any;
}

// 创建axios实例
// baseURL 优先读取 VITE_API_BASE_URL 环境变量（在 .env.production 中配置）
// 未设置时：生产回退到 /api（需 CDN/反向代理同源），开发由 Vite proxy 代理到 localhost:3000
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const instance: any = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 30000,
});

// 请求拦截器
instance.interceptors.request.use(
  (config: any) => {
    // 从localStorage获取token（兼容两种键名）
    const token =
      localStorage.getItem("admin-token") || localStorage.getItem("adminToken");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: any) => {
    return Promise.reject(error);
  },
);

// 响应拦截器
instance.interceptors.response.use(
  (response: any) => {
    // 直接返回 response.data，简化调用
    return response.data;
  },
  (error: any) => {
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
      } else if (status === 403 && data?.error === "community_expired") {
        // 小区到期错误，不在这里处理，让调用方处理
        // 直接抛出错误，不显示全局提示
      } else if (status >= 500) {
        // 500 错误显示服务器错误
        const errorMsg = data?.error || data?.message || "服务器错误";
        ElMessage.error(errorMsg);
      }
      // 其他错误（如404、400等）不显示全局错误提示，由调用方处理
    } else if (error.request) {
      // 网络错误或超时
      if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
        ElMessage.error("请求超时，请稍后重试");
      } else {
        ElMessage.error("网络错误，请检查连接");
      }
    } else {
      ElMessage.error(error.message || "请求失败");
    }

    return Promise.reject(error);
  },
);

export default instance;
