/// <reference types="vite/client" />
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const __vue_component__: DefineComponent<{}, {}, any>;
  export default __vue_component__;
}
