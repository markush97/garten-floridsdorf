export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['landing', 'poll', 'admin', 'api', 'db', 'ui', 'deps', 'config'],
    ],
  },
}
