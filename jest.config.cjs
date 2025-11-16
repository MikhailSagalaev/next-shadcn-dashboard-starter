/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/sanity.test.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^~/(.*)$': '<rootDir>/public/$1',
    '^lru-cache$': '<rootDir>/test/__mocks__/lru-cache.js',
    '^lru-cache/(.*)$': '<rootDir>/test/__mocks__/lru-cache.js',
    '^@asamuzakjp/css-color$': '<rootDir>/test/__mocks__/css-color.js',
    '^@asamuzakjp/css-color/(.*)$': '<rootDir>/test/__mocks__/css-color.js',
    '^@asamuzakjp/css-color/dist/cjs/index.cjs$': '<rootDir>/test/__mocks__/css-color.js'
  }
};

