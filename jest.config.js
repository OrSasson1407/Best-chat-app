module.exports = {
  testEnvironment: 'node',
  rootDir: './',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  transformIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/',
    '^server/(.*)$': '<rootDir>/server/'
  }
};
