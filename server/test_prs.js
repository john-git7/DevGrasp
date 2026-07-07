require('dotenv').config();
const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function checkPrs() {
  try {
    const response = await octokit.rest.pulls.list({
      owner: 'john-git7',
      repo: 'DRM',
      state: 'open',
      per_page: 20
    });
    console.log(`Found ${response.data.length} PRs.`);
    response.data.forEach(pr => console.log(pr.title));
  } catch(e) {
    console.error(e);
  }
}

checkPrs();
