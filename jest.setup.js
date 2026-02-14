// Jest setup file for Skibidi POS - Minimal version for unit tests
// This file is minimal since we mainly test pure utility functions

// Silence console warnings during tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
