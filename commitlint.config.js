module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'docs', 'style', 'test', 'chore', 'perf', 'ci']],
    'scope-enum': [2, 'always', ['admin', 'frontend', 'miniprogram', 'cloudfunction', 'shared']],
    'subject-max-length': [2, 'always', 72],
  },
};
