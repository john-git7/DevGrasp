// Sentry MUST be initialized before all other requires
require('./instrument');
const Sentry = require('@sentry/node');

const express = require('express');
const dns = require('dns');
// Override local DNS to fix SRV lookup failures on this network
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const usageTracker = require('./services/usageTracker');
const { requireApiKey } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5001;

const authRoute = require('./routes/auth');
const reposRoute = require('./routes/repos');
const chatRoute = require('./routes/chat');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Auth routes (unprotected inside)
app.use('/api/auth', authRoute);

const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Increased from 50 to allow client polling
  message: { error: 'Too many requests, slow down.' }
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200 // Increased from 20
});

// Apply API key authentication to all /api routes
app.use('/api', requireApiKey);

app.use('/api/', limiter);
app.use('/api/chat', aiLimiter);

app.use('/api/repos', reposRoute);
app.use('/api/chat', chatRoute);

// GET usage metrics
app.get('/api/status/usage', (req, res) => {
  res.json(usageTracker.getUsage());
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { family: 4 })
  .then(async () => {
    console.log('Connected to MongoDB Atlas');
    // Clean up any stale indexing states from previous server crashes
    try {
      const RepoStatus = require('./models/RepoStatus');
      const result = await RepoStatus.updateMany(
        { status: 'indexing' },
        { status: 'error' } // Mark as INCOMPLETE so user can resume
      );
      if (result.modifiedCount > 0) {
        console.log(`Cleaned up ${result.modifiedCount} stale indexing states.`);
      }
    } catch(e) {
      console.error('Failed to cleanup stale indexing states:', e);
    }
  })
  .catch((err) => console.error('MongoDB connection error:', err));

const { retrieveContext } = require('./services/retriever');
const Conversation = require('./models/Conversation');
// Fetch Open PRs for a repo
app.get('/api/repos/prs', async (req, res) => {
  const { repoUrl } = req.query;
  if (!repoUrl) return res.status(400).json({ error: 'repoUrl is required' });
  try {
    let owner = '', repoName = '';
    const parts = repoUrl.split('/').filter(Boolean);
    if(parts.length >= 2) {
      owner = parts[parts.length - 2];
      repoName = parts[parts.length - 1].replace(/\.git$/, '');
    } else {
      return res.status(400).json({ error: 'Invalid repoUrl format' });
    }
    
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const prs = await octokit.rest.pulls.list({
      owner,
      repo: repoName,
      state: 'open',
      per_page: 20
    });
    
    // Return minimal PR data to UI
    const prData = prs.data.map(pr => ({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      author: pr.user.login,
      createdAt: pr.created_at
    }));
    
    res.json(prData);
  } catch (err) {
    console.error('Error fetching PRs:', err.message);
    res.status(500).json({ error: 'Failed to fetch PRs' });
  }
});

// Fetch conversation history for a repo
app.get('/api/chat/history', async (req, res) => {
  const { repoId } = req.query;
  if (!repoId) return res.status(400).json({ error: 'repoId is required' });
  try {
    const conversations = await Conversation.find({ repoId }).sort({ createdAt: -1 });
    res.json(conversations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Fetch a specific conversation
app.get('/api/chat/conversation/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Not found' });
    res.json(conversation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Delete a specific conversation
app.delete('/api/chat/conversation/:id', async (req, res) => {
  try {
    const deleted = await Conversation.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// Truncate a conversation history
app.put('/api/chat/conversation/:id/truncate', async (req, res) => {
  try {
    const { messageIndex } = req.body;
    if (typeof messageIndex !== 'number') return res.status(400).json({ error: 'messageIndex is required' });
    
    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ error: 'Not found' });
    
    convo.messages = convo.messages.slice(0, messageIndex);
    await convo.save();
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to truncate conversation' });
  }
});

// Delete a specific conversation
app.delete('/api/repos/:owner/:repo', async (req, res) => {
  const { owner, repo } = req.params;
  try {
    const repoUrl = `https://github.com/${owner}/${repo}`;
    await Chunk.deleteMany({ repoUrl });
    await RepoStatus.deleteOne({ repoUrl });
    res.json({ success: true, message: 'Repository deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete repository' });
  }
});

// GET usage metrics
app.get('/api/status/usage', (req, res) => {
  res.json(usageTracker.getUsage());
});

// Streaming Chat Endpoint with RAG Integration
app.post('/api/chat', async (req, res) => {
  const { message, repoUrl, conversationId } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Stream status update to frontend
    res.write(`data: ${JSON.stringify({ status: 'Searching your repository...' })}\n\n`);
    
    // 1. Retrieve relevant code context from MongoDB, filtering by selected repo if provided
    const context = await retrieveContext(message, repoUrl);

    // 2. Build the System Prompt
    let systemPrompt = `You are DevGrasp, an expert AI coding assistant.
You have access to the user's codebase. Use the following code snippets to answer the user's question accurately.
If the answer is not in the snippets, just answer based on your general knowledge.

Respond conversationally in plain paragraphs. Never use markdown headers (##), never use bullet points, keep answers under 150 words unless the user explicitly asks for detail. You are a chat assistant, not a documentation generator.

At the very end of your response, you MUST include a special line starting with "__CITATIONS__:" followed by a comma-separated list of the file paths you used to answer the question. Do not include files you did not use.`;

    if (context) {
      systemPrompt += `\n\n### Codebase Context ###\n${context}`;
    }

    let convoId = conversationId;
    let historyMessages = [];

    if (convoId) {
      // Fetch history BEFORE adding the current message
      const convo = await Conversation.findById(convoId);
      if (convo) {
        historyMessages = convo.messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));
      }
      // Now save the current user message
      await Conversation.findByIdAndUpdate(convoId, {
        $push: { messages: { role: 'user', content: message } }
      });
    } else if (repoUrl) {
      const newConvo = new Conversation({
        repoId: repoUrl,
        title: message.substring(0, 40) + (message.length > 40 ? '...' : ''),
        messages: [{ role: 'user', content: message }]
      });
      await newConvo.save();
      convoId = newConvo._id.toString();
    }

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. I have the context and instructions.' }] },
        ...historyMessages
      ]
    });

    res.write(`data: ${JSON.stringify({ status: 'Generating response...' })}\n\n`);

    // 3. Generate the response with automatic retry for 503 errors
    const result = await executeWithRetry(() => chat.sendMessageStream(message));

    // Send conversationId immediately so frontend knows it
    if (convoId) {
      res.write(`data: ${JSON.stringify({ conversationId: convoId })}\n\n`);
    }

    let fullAssistantResponse = '';
    // As Gemini generates tokens, they come through this async iterator
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        fullAssistantResponse += chunkText;
        // SSE messages must start with "data: " and end with "\n\n"
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }
    }
    
    // Save assistant response to DB
    if (convoId) {
      await Conversation.findByIdAndUpdate(convoId, {
        $push: { messages: { role: 'assistant', content: fullAssistantResponse } }
      });
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Gemini API error:', error);
    const errMsg = formatGeminiError(error, 'Failed to generate response. Please check your API key and connection.');
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    res.end();
  }
});

// Phase 2: Idea 1 - Codebase Onboarding Assistant
const Chunk = require('./models/Chunk');

app.post('/api/chat/onboarding', async (req, res) => {
  const { repoUrl } = req.body;
  if (!repoUrl) return res.status(400).json({ error: 'Repo URL is required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    res.write(`data: ${JSON.stringify({ status: 'Analyzing architecture...' })}\n\n`);

    // Fetch the file tree
    const files = await Chunk.distinct('filePath', { repoUrl });
    const fileTree = files.join('\n');

    // Fetch key documents if they exist
    const readmeChunk = await Chunk.findOne({ repoUrl, filePath: { $regex: /README\.md$/i } });
    const packageJsonChunk = await Chunk.findOne({ repoUrl, filePath: { $regex: /package\.json$/i } });

    let contextData = `File Tree:\n${fileTree}\n\n`;
    if (readmeChunk) contextData += `README Context:\n${readmeChunk.content.substring(0, 1500)}\n\n`;
    if (packageJsonChunk) contextData += `Dependencies (package.json):\n${packageJsonChunk.content.substring(0, 1500)}\n\n`;

    const prompt = `You are DevGrasp, a Senior Staff Engineer.
A new developer just joined the team. Generate a comprehensive, living onboarding document for this codebase.
Map out the high-level architecture, explain major modules based on the file tree, and summarize the core dependencies.
Use Markdown with clear headers (##), bold text, and bullet points. Make it easy to read.

Here is the codebase context:
${contextData}`;

    const newConvo = new Conversation({
      repoId: repoUrl,
      title: 'Codebase Onboarding Guide',
      messages: [{ role: 'user', content: 'Generate an onboarding guide for this codebase.' }]
    });
    await newConvo.save();
    const convoId = newConvo._id.toString();

    res.write(`data: ${JSON.stringify({ status: 'Writing onboarding guide...' })}\n\n`);
    res.write(`data: ${JSON.stringify({ conversationId: convoId })}\n\n`);

    const result = await executeWithRetry(() => model.generateContentStream(prompt));

    let fullAssistantResponse = '';
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        fullAssistantResponse += chunkText;
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }
    }

    await Conversation.findByIdAndUpdate(convoId, {
      $push: { messages: { role: 'assistant', content: fullAssistantResponse } }
    });

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Onboarding Generation Error:', error);
    const errMsg = formatGeminiError(error, 'Failed to generate onboarding document.');
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    res.end();
  }
});

// Phase 3: Idea 2 - Bug Context Tracer
app.post('/api/chat/bug-trace', async (req, res) => {
  const { repoUrl, stackTrace } = req.body;
  if (!repoUrl || !stackTrace) return res.status(400).json({ error: 'Repo URL and stack trace are required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    res.write(`data: ${JSON.stringify({ status: 'Analyzing stack trace...' })}\n\n`);

    // Extract potential file names/paths from the stack trace
    // Matches common extensions: .js, .jsx, .ts, .tsx, .py, .go, .java, .c, .cpp, .h, etc.
    const fileRegex = /([a-zA-Z0-9_\-\./\\]+\.(?:js|jsx|ts|tsx|py|go|java|c|cpp|h|cs|rb|php))/gi;
    const matches = [...new Set(stackTrace.match(fileRegex) || [])];

    // Clean up matches to get basenames or relative paths
    const searchTokens = matches.map(m => m.split(/[/\\]/).pop());

    res.write(`data: ${JSON.stringify({ status: 'Fetching related files...' })}\n\n`);

    let contextData = '';
    
    // Fetch matching files from the Chunk collection
    if (searchTokens.length > 0) {
      // Create a regex to match any of the file basenames
      const regexTokens = searchTokens.map(token => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const searchRegex = new RegExp(`(${regexTokens.join('|')})$`, 'i');
      
      const relatedChunks = await Chunk.find({ 
        repoUrl, 
        filePath: { $regex: searchRegex } 
      }).limit(10); // Limit to 10 chunks to avoid massive context
      
      for (const chunk of relatedChunks) {
        contextData += `### File: ${chunk.filePath} ###\n${chunk.content}\n\n`;
      }
    }
    
    if (!contextData) {
      contextData = "No specific files identified from the stack trace.";
    }

    const prompt = `You are DevGrasp, a Senior Debugging Engineer.
The user has provided a stack trace or error message. Your job is to trace the bug, explain WHY it is happening based on the provided codebase context, and trace the function calls.
Do not just rewrite the code to fix it. Explain the underlying system failure.
Use Markdown to format your response clearly.

At the very end of your response, you MUST include a special line starting with "__CITATIONS__:" followed by a comma-separated list of the file paths you used to answer the question.

### Stack Trace / Error ###
${stackTrace}

### Related Codebase Files ###
${contextData}`;

    const newConvo = new Conversation({
      repoId: repoUrl,
      title: `Bug Trace: ${stackTrace.split('\n')[0].substring(0, 30)}...`,
      messages: [{ role: 'user', content: `Please trace this bug:\n\n${stackTrace}` }]
    });
    await newConvo.save();
    const convoId = newConvo._id.toString();

    res.write(`data: ${JSON.stringify({ status: 'Tracing bug...' })}\n\n`);
    res.write(`data: ${JSON.stringify({ conversationId: convoId })}\n\n`);

    const result = await executeWithRetry(() => model.generateContentStream(prompt));

    let fullAssistantResponse = '';
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        fullAssistantResponse += chunkText;
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }
    }

    await Conversation.findByIdAndUpdate(convoId, {
      $push: { messages: { role: 'assistant', content: fullAssistantResponse } }
    });

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Bug Trace Error:', error);
    const errMsg = formatGeminiError(error, 'Failed to trace bug.');
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    res.end();
  }
});



// Phase 4: Idea 3 - Tech Debt Radar
app.post('/api/chat/tech-debt', async (req, res) => {
  const { repoUrl } = req.body;
  if (!repoUrl) return res.status(400).json({ error: 'Repo URL is required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    res.write(`data: ${JSON.stringify({ status: 'Analyzing entire codebase...' })}\n\n`);

    // Fetch all chunks for the repo to feed into Gemini's massive context window
    const allChunks = await Chunk.find({ repoUrl });
    let fullContext = '';
    
    for (const chunk of allChunks) {
      // Exclude obviously minified or binary-like files if any snuck in, though Chunk schema usually implies text
      if (chunk.filePath.match(/\.(min\.js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i)) continue;
      fullContext += `### FILE: ${chunk.filePath} ###\n${chunk.content}\n\n`;
    }

    // Limit context length if it's ridiculously huge (e.g. > 2M tokens). 1 char is ~0.25 tokens. 
    // We'll cap at 4 million characters (approx 1M tokens).
    if (fullContext.length > 4000000) {
      fullContext = fullContext.substring(0, 4000000) + "\n\n...[TRUNCATED DUE TO SIZE]...";
    }

    const prompt = `You are DevGrasp, a Senior Principal Engineer.
Your task is to act as a "Tech Debt Radar". Analyze the provided codebase and generate a prioritized tech debt report.
Look for:
- Duplicated logic
- Deeply nested functions or complex control flows
- Files with lacking error handling
- Inconsistent or outdated patterns
- Overly massive files that need breaking down

Provide specific file citations and explain WHY they are problematic and HOW to refactor them.
Use Markdown with clear headers (##), bullet points, and bold text.

### Codebase Context ###
${fullContext}`;

    const newConvo = new Conversation({
      repoId: repoUrl,
      title: 'Tech Debt Radar Report',
      messages: [{ role: 'user', content: 'Generate a Tech Debt report for this codebase.' }]
    });
    await newConvo.save();
    const convoId = newConvo._id.toString();

    res.write(`data: ${JSON.stringify({ status: 'Generating Tech Debt Report...' })}\n\n`);
    res.write(`data: ${JSON.stringify({ conversationId: convoId })}\n\n`);

    const result = await executeWithRetry(() => model.generateContentStream(prompt));

    let fullAssistantResponse = '';
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        fullAssistantResponse += chunkText;
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }
    }

    await Conversation.findByIdAndUpdate(convoId, {
      $push: { messages: { role: 'assistant', content: fullAssistantResponse } }
    });

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Tech Debt Generation Error:', error);
    const errMsg = formatGeminiError(error, 'Failed to generate Tech Debt report.');
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    res.end();
  }
});

// Phase 4: Idea 4 - Commit Story Generator
// (Octokit is now required at the top of the file)

app.post('/api/chat/commit-story', async (req, res) => {
  const { repoUrl, commitCount = 20 } = req.body;
  if (!repoUrl) return res.status(400).json({ error: 'Repo URL is required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    res.write(`data: ${JSON.stringify({ status: 'Fetching recent commits...' })}\n\n`);

    // Parse owner and repo from URL, e.g. "https://github.com/facebook/react" -> "facebook", "react"
    let owner = '', repo = '';
    try {
      const urlParts = new URL(repoUrl).pathname.split('/').filter(Boolean);
      if (urlParts.length >= 2) {
        owner = urlParts[0];
        repo = urlParts[1];
      } else {
         throw new Error("Invalid format");
      }
    } catch(e) {
       // Fallback logic for format like "owner/repo"
       const parts = repoUrl.split('/');
       if(parts.length >= 2) {
         owner = parts[parts.length - 2];
         repo = parts[parts.length - 1];
       } else {
         throw new Error("Could not parse owner/repo from URL");
       }
    }
    
    // Clean up .git if present
    repo = repo.replace(/\.git$/, '');

    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    
    const commitsRes = await octokit.rest.repos.listCommits({
      owner,
      repo,
      per_page: commitCount
    });
    
    const commits = commitsRes.data;
    
    res.write(`data: ${JSON.stringify({ status: 'Fetching commit diffs...' })}\n\n`);
    
    let commitHistoryText = '';
    
    // Fetch diffs for the latest commits to get more context
    for (let i = 0; i < Math.min(commits.length, commitCount); i++) {
      const commit = commits[i];
      let diffText = '';
      try {
        const commitDetails = await octokit.rest.repos.getCommit({
          owner,
          repo,
          ref: commit.sha
        });
        
        if (commitDetails.data.files) {
          diffText = commitDetails.data.files.map(f => {
            return `File: ${f.filename}\nStatus: ${f.status}\nChanges: +${f.additions} -${f.deletions}\nPatch: ${f.patch ? f.patch.substring(0, 500) + (f.patch.length > 500 ? '...' : '') : 'N/A'}`;
          }).join('\n\n');
        }
      } catch (err) {
        console.error(`Failed to fetch diff for commit ${commit.sha}`, err.message);
      }
      
      commitHistoryText += `### Commit ${commit.sha.substring(0, 7)} by ${commit.commit.author.name} on ${commit.commit.author.date} ###\n`;
      commitHistoryText += `Message: ${commit.commit.message}\n`;
      if (diffText) {
         commitHistoryText += `Diff Summary:\n${diffText}\n`;
      }
      commitHistoryText += `\n----------------------------------\n\n`;
    }

    const prompt = `You are DevGrasp, a Senior Technical Writer and Architect.
I am providing you with the last ${commitCount} commits and diffs from the repository ${owner}/${repo}.
Your task is to generate a human-readable "Commit Story" (Changelog & Architecture Decision Record).
Synthesize the technical changes into a cohesive narrative about what the team has been building, why they built it, and what major refactors or new features were introduced.
Use Markdown with clear headers (##), bold text, and bullet points. Make it sound professional yet engaging.

### Commit History ###
${commitHistoryText}`;

    const newConvo = new Conversation({
      repoId: repoUrl,
      title: 'Commit Story Generator',
      messages: [{ role: 'user', content: `Generate a Commit Story for the last ${commitCount} commits.` }]
    });
    await newConvo.save();
    const convoId = newConvo._id.toString();

    res.write(`data: ${JSON.stringify({ status: 'Generating Commit Story narrative...' })}\n\n`);
    res.write(`data: ${JSON.stringify({ conversationId: convoId })}\n\n`);

    const result = await executeWithRetry(() => model.generateContentStream(prompt));

    let fullAssistantResponse = '';
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        fullAssistantResponse += chunkText;
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }
    }

    await Conversation.findByIdAndUpdate(convoId, {
      $push: { messages: { role: 'assistant', content: fullAssistantResponse } }
    });

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Commit Story Generation Error:', error);
    const errMsg = formatGeminiError(error, 'Failed to generate commit story.');
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    res.end();
  }
});

// Phase 5: Idea 5 - Interactive PR Review
app.post('/api/chat/pr-review', async (req, res) => {
  const { repoUrl, prNumber, message, conversationId } = req.body;
  if (!repoUrl || !prNumber || !message) return res.status(400).json({ error: 'repoUrl, prNumber, and message are required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    let owner = '', repoName = '';
    const parts = repoUrl.split('/').filter(Boolean);
    if(parts.length >= 2) {
      owner = parts[parts.length - 2];
      repoName = parts[parts.length - 1].replace(/\.git$/, '');
    } else {
      throw new Error("Invalid format");
    }

    res.write(`data: ${JSON.stringify({ status: 'Fetching PR details...' })}\n\n`);
    
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    
    // Fetch PR diff
    const diffRes = await octokit.rest.pulls.get({
      owner,
      repo: repoName,
      pull_number: prNumber,
      mediaType: {
        format: 'diff'
      }
    });
    
    const prDiff = diffRes.data;
    
    res.write(`data: ${JSON.stringify({ status: 'Fetching repository context...' })}\n\n`);
    
    // We could do a vector search here, but for now we'll just provide the PR diff
    // since the diff often contains enough context, and we can fetch specific files if needed
    // based on the diff. Let's try to get chunks that match the files changed in the PR to help with merge conflict analysis.
    
    // Extract file paths from the diff (lines starting with +++ b/ or --- a/)
    const filePaths = [...new Set([...prDiff.matchAll(/(?:\+\+\+ b\/|--- a\/)(.*)/g)].map(m => m[1]))];
    
    let currentContext = '';
    if (filePaths.length > 0) {
      const searchTokens = filePaths.map(p => p.split(/[/\\]/).pop().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      if (searchTokens.length > 0) {
         const searchRegex = new RegExp(`(${searchTokens.join('|')})$`, 'i');
         const relatedChunks = await Chunk.find({ 
           repoUrl, 
           filePath: { $regex: searchRegex } 
         }).limit(15);
         
         for (const chunk of relatedChunks) {
           currentContext += `### CURRENT MASTER FILE: ${chunk.filePath} ###\n${chunk.content}\n\n`;
         }
      }
    }

    let convoId = conversationId;
    let messages = [];

    if (convoId) {
      const convo = await Conversation.findById(convoId);
      if (convo) {
        messages = convo.messages.map(m => ({ role: m.role, content: m.content }));
      }
    } else {
      const newConvo = new Conversation({
        repoId: repoUrl,
        title: `PR #${prNumber} Review`,
        messages: []
      });
      await newConvo.save();
      convoId = newConvo._id.toString();
    }
    
    res.write(`data: ${JSON.stringify({ conversationId: convoId })}\n\n`);

    // Prepare history for Gemini
    const history = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const systemPrompt = `You are DevGrasp, an expert Code Reviewer.
The user is asking you about Pull Request #${prNumber} in ${owner}/${repoName}.
I am providing you with the unified diff of the PR, and the current state of the modified files in the main branch (to help check for merge conflicts or issues).

### PR Unified Diff ###
${prDiff.length > 20000 ? prDiff.substring(0, 20000) + '\n...[DIFF TRUNCATED]' : prDiff}

### Current Files in Main Branch (Context) ###
${currentContext.length > 50000 ? currentContext.substring(0, 50000) + '\n...[CONTEXT TRUNCATED]' : currentContext || 'No context found.'}

If the user asks "will it cause a merge conflict?", compare the Diff with the Current Files to see if they overlap in ways that Git cannot auto-merge.
Always be helpful, specific, and cite file names or line numbers when possible.`;

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: "Understood. I have the PR diff and context." }] },
        ...history
      ]
    });

    res.write(`data: ${JSON.stringify({ status: 'Analyzing PR and formulating response...' })}\n\n`);

    const result = await executeWithRetry(() => chat.sendMessageStream(message));

    let fullAssistantResponse = '';
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        fullAssistantResponse += chunkText;
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }
    }

    await Conversation.findByIdAndUpdate(convoId, {
      $push: { 
        messages: [
          { role: 'user', content: message },
          { role: 'assistant', content: fullAssistantResponse }
        ]
      }
    });

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('PR Review Error:', error);
    const errMsg = formatGeminiError(error, 'Failed to process PR review.');
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    res.end();
  }
});

// Sentry error handler MUST be registered after all routes and before app.listen
// It captures any errors thrown inside route handlers and sends them to Sentry
Sentry.setupExpressErrorHandler(app);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
