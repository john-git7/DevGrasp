class Octokit {
  constructor() {
    this.repos = {
      getContent: jest.fn().mockResolvedValue({ data: [] }),
      get: jest.fn().mockResolvedValue({ data: { default_branch: 'main' } })
    };
    this.git = {
      getTree: jest.fn().mockResolvedValue({ data: { tree: [] } })
    };
    this.pulls = {
      list: jest.fn().mockResolvedValue({ data: [] })
    };
  }
}
module.exports = { Octokit };
