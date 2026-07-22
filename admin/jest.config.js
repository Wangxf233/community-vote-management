module.exports = {
  testEnvironment: "node",
  rootDir: "..",
  testMatch: ["<rootDir>/admin/__tests__/**/*.test.js"],
  clearMocks: true,
  collectCoverageFrom: [
    "admin/routes/**/*.js",
    "admin/middleware/**/*.js",
    "admin/utils/**/*.js",
    "!**/node_modules/**",
  ],
};
