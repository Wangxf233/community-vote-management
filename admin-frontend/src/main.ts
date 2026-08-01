import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
// @ts-ignore — element-plus locale .mjs 无类型声明
import zhCn from "element-plus/dist/locale/zh-cn.mjs";
import "element-plus/dist/index.css";
import App from "./App.vue";
import router from "./router";
import "./styles.css";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });
app.mount("#app");
