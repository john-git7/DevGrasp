module.exports = {
  pipeline: jest.fn().mockResolvedValue(jest.fn().mockResolvedValue([1, 2, 3])),
  env: {
    allowLocalModels: false,
    useBrowserCache: false
  }
};
