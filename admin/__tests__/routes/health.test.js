const request = require("supertest");

// 因为 server.js 启动时会监听端口，这里不直接 require server.js
// 而是测试 Express app 实例。需要先从 server.js 导出 app。
// 在 server.js 支持导出之前，先用基础结构验证测试框架可用。

describe("Health Check", () => {
  it("测试框架配置正确", () => {
    expect(1 + 1).toBe(2);
  });

  // 以下测试在 server.js 支持导出 app 后启用：
  // it("GET /api/health should return 200", async () => {
  //   const res = await request(app).get("/api/health");
  //   expect(res.status).toBe(200);
  //   expect(res.body.status).toBe("ok");
  // });
});
