const path = require('path');

// 说明：不使用 `cd <子目录> && npx eslint` 形式 —— 在 Windows（Git Bash / cmd 混用）
// 环境下 lint-staged 启动该命令会报"系统找不到指定的路径"或挂起，导致提交被误拦截。
// 这里改为从仓库根目录直接调用各子项目 node_modules 内的 eslint / prettier，
// 路径均为跨平台写法（node 直接执行 JS 入口，不依赖 shell 的 cd/npx 解析）。
// ESLint / Prettier 会按被检查文件所在目录自动向上查找各自的配置文件，行为不变。
const toRepoRelative = (filenames) =>
  filenames.map((f) => path.relative('.', f).replace(/\\/g, '/')).join(' ');

module.exports = {
  'admin-frontend/src/**/*.{vue,ts}': (filenames) => {
    const files = toRepoRelative(filenames);
    return [
      `node admin-frontend/node_modules/eslint/bin/eslint.js --fix ${files}`,
      `node admin-frontend/node_modules/prettier/bin/prettier.cjs --write ${files}`,
    ];
  },
  'admin/**/*.js': (filenames) => {
    const files = toRepoRelative(filenames);
    return `node admin/node_modules/eslint/bin/eslint.js --fix ${files}`;
  },
};
