# 小程序前端性能测试手册

依赖微信开发者工具图形界面与真机数据，按以下步骤操作并填写记录。

## 一、核心页面清单

| 页面 | 路径 | 首屏主要接口 |
|------|------|-------------|
| 服务首页 | pages/service/index | getCommunityInfo + 小区信息 |
| 投票列表 | pages/vote | listVotes |
| 投票详情 | pages/vote-detail | getVoteDetail（+verifyRealName） |
| 开门 | pages/door | listDoorDevices |
| 挪车（业主） | pages/movecar | movecarQuery（点击后） |
| 挪车（工作人员） | pages/staff-movecar | staffQueryVehicle |
| 评价 | pages/evaluation | listEvaluationCycles |
| 通知详情 | pages/information-detail | getAnnouncementDetail |
| 我的 | pages/profile | getBindingInfo 等 |

## 二、微信开发者工具·体验评分

1. 开发者工具打开项目 → 菜单「工具」→「体验评分」（或详情 → 性能数据）
2. 对上述核心页面逐页打开并提交评分
3. 记录：性能维度得分、指出的问题（setData 频率、包大小、图片过大等）

## 三、Performance 面板录制

1. 调试器 → Performance 面板 → 录制
2. 依次进入核心页面，停留至首屏渲染完成，停止录制
3. 按页面记录：

| 页面 | 首屏渲染(ms) | 接口总耗时(ms) | 最大单次 setData(ms) | 备注 |
|------|-------------|---------------|---------------------|------|
| 服务首页 | | | | |
| 投票列表 | | | | |
| 投票详情 | | | | |
| 开门 | | | | |
| 挪车（业主） | | | | |
| 挪车（工作人员） | | | | |
| 评价 | | | | |
| 通知详情 | | | | |
| 我的 | | | | |

**基线建议**：首屏渲染 < 2s；单次 setData < 30ms；接口 p95 < 1s（弱网 4G 下放宽到 2s）

## 四、真机数据监控（上线后持续）

微信公众平台 → 小程序管理后台 → 「数据分析」→「性能分析」：
- 启动耗时、页面切换耗时、内存分布（真机用户数据，免埋码）
- 建议每周看一次，重点关注投票页与开门页的加载耗时

## 五、已知优化项（代码层面）

- 图片上传已做 512KB 压缩（挪车违停照片）
- 主包体积检查：避免超过 1.5MB（当前 33 页面，若接近上限考虑分包）
- 投票详情页 getVoteDetail 每次拉取小区全量 owner_list（后端无 limit），小区数据量大时首屏变慢 —— 与后端压测报告中的读放大项联动
