module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testTimeout: 120000, // 2m timeout for tests needing to boot in-memory DB or download it
  globalSetup: './tests/globalSetup.js',
  setupFilesAfterEnv: ['./tests/setup.js'],
  moduleNameMapper: {
    '^@octokit/rest$': '<rootDir>/tests/mocks/octokitMock.js',
    '^octokit$': '<rootDir>/tests/mocks/octokitMock.js',
    '^@xenova/transformers$': '<rootDir>/tests/mocks/transformersMock.js',
    '^@google/generative-ai$': '<rootDir>/tests/mocks/geminiMock.js'
  }
};
