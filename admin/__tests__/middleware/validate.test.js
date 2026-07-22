const { validate } = require("../../middleware/validate");

function mockReq(body) {
  return { body };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("validate middleware", () => {
  it("should pass valid repair data", () => {
    const req = mockReq({
      communityId: "test-community",
      equipment: "电梯",
      location: "1栋1单元",
      description: "电梯故障",
    });
    const res = mockRes();
    const next = jest.fn();

    const middleware = validate("createRepair");
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.validatedBody).toBeDefined();
    expect(req.validatedBody.equipment).toBe("电梯");
  });

  it("should reject missing required fields", () => {
    const req = mockReq({});
    const res = mockRes();
    const next = jest.fn();

    const middleware = validate("createRepair");
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.error).toBe("validation_error");
    expect(body.details.length).toBeGreaterThan(0);
    expect(next).not.toHaveBeenCalled();
  });

  it("should validate phone format in register", () => {
    const req = mockReq({
      username: "test",
      password: "123456",
      phone: "not-a-phone",
      communityName: "测试小区",
      verifyCode: "1234",
    });
    const res = mockRes();
    const next = jest.fn();

    const middleware = validate("register");
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should accept valid registration data", () => {
    const req = mockReq({
      username: "test",
      password: "123456",
      phone: "13812345678",
      communityName: "测试小区",
      verifyCode: "1234",
    });
    const res = mockRes();
    const next = jest.fn();

    const middleware = validate("register");
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("should reject invalid cert review action", () => {
    const req = mockReq({ action: "invalid" });
    const res = mockRes();
    const next = jest.fn();

    const middleware = validate("reviewCertification");
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
