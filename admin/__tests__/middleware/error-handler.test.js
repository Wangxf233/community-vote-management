const { AppError, ERROR_CODES } = require("../../../shared/error-codes");
const { errorHandler } = require("../../middleware/error-handler");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("AppError", () => {
  it("should create an error with correct properties", () => {
    const err = new AppError(ERROR_CODES.VALIDATION_ERROR, "phone is invalid");
    expect(err.code).toBe("validation_error");
    expect(err.httpStatus).toBe(400);
    expect(err.detail).toBe("phone is invalid");
    expect(err instanceof Error).toBe(true);
  });
});

describe("errorHandler middleware", () => {
  it("should return AppError with correct status and code", () => {
    const req = {};
    const res = mockRes();
    const err = new AppError(ERROR_CODES.RESOURCE_NOT_FOUND);

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "resource_not_found",
    });
  });

  it("should return 500 for unknown errors without exposing details", () => {
    const req = {};
    const res = mockRes();
    const err = new Error("secret internal detail");

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(false);
    expect(response.error).toBe("internal_error");
    // 不暴露内部错误信息
    expect(response.error).not.toContain("secret");
  });
});
