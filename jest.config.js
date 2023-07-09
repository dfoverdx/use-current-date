/** @type {import("jest").Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  rootDir: './src',
  setupFilesAfterEnv: ['@testing-library/jest-dom/extend-expect'],
  transform: {
    '.*\.tsx?': ['ts-jest', {
      tsconfig: '<rootDir>/../tsconfig.test.json',
    }],
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
  ],
  watchPathIgnorePatterns: [
    '/coverage/',
    '/.vscode/',
  ]
};
