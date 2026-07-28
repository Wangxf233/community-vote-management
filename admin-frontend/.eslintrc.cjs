/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  extends: [
    'plugin:vue/vue3-recommended',
    'eslint:recommended',
    'prettier',
  ],
  plugins: ['@typescript-eslint'],
  rules: {
    // Vue 规则
    'vue/multi-word-component-names': 'off',
    'vue/no-v-html': 'error',
    'vue/component-name-in-template-casing': 'off',
    'vue/script-setup-uses-vars': 'warn',
    'vue/no-deprecated-v-on-native-modifier': 'warn',

    // TypeScript 规则
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

    // 通用规则（覆盖 preset 的 error 为 warn，不影响存量代码 CI）
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'prefer-const': 'warn',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-undef': 'warn',
  },
  overrides: [
    {
      files: ['*.config.js', '*.config.ts'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
};
