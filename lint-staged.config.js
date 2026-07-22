module.exports = {
  'admin-frontend/src/**/*.{vue,ts}': (filenames) => {
    const files = filenames.map(f => f.replace(/\\/g, '/')).join(' ');
    return [
      `cd admin-frontend && npx eslint --fix ${files}`,
      `cd admin-frontend && npx prettier --write ${files}`,
    ];
  },
  'admin/**/*.js': (filenames) => {
    const files = filenames.map(f => f.replace(/\\/g, '/')).join(' ');
    return `cd admin && npx eslint --fix ${files}`;
  },
};
