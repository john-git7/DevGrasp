import { Request, Response } from 'express';
import Conversation from '../models/Conversation';
import Chunk from '../models/Chunk';
import User from '../models/User';
import { decrypt } from '../utils/crypto';
import { Octokit } from '@octokit/rest';
import { genAI, getChatModel, formatGeminiError } from '../utils/gemini';

async function getUserToken(userId?: string) {
  if (!userId) return null;
  const user = await User.findById(userId);
  if (user && user.githubToken && user.githubToken.encryptedData) {
    return decrypt(user.githubToken as any);
  }
  return null;
}
import { retrieveContext } from '../services/retriever';
import { executeWithRetry } from '../utils/retry';
import { 
  buildRagPrompt, 
  buildOnboardingPrompt, 
  buildBugTracePrompt, 
  buildCommitStoryPrompt, 
  buildPRReviewPrompt 
} from '../services/promptBuilder';
import { AuthenticatedRequest } from '../middleware/auth';

export const getHistory = async (req: AuthenticatedRequest, res: Response) => {
  const { repoId } = req.query as { repoId?: string };
  if (!repoId) return res.status(400).json({ error: 'repoId is required' });
  try {
    const conversations = await Conversation.find({ repoId, userId: req.user.id }).sort({ createdAt: -1 });
    res.json(conversations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
};

export const getConversation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.user.id });
    if (!conversation) return res.status(404).json({ error: 'Not found' });
    res.json(conversation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
};

export const deleteConversation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await Conversation.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
};

export const truncateConversation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { messageIndex } = req.body;
    if (typeof messageIndex !== 'number') return res.status(400).json({ error: 'messageIndex is required' });
    
    const convo = await Conversation.findOne({ _id: req.params.id, userId: req.user.id });
    if (!convo) return res.status(404).json({ error: 'Not found' });
    
    const slicedMessages = convo.messages.slice(0, messageIndex);
    await Conversation.updateOne(
      { _id: req.params.id, userId: req.user.id },
      { $set: { messages: slicedMessages } }
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to truncate conversation' });
  }
};

export const chat = async (req: AuthenticatedRequest, res: Response) => {
  let { message, repoUrl, conversationId, chatModel, embeddingModel } = req.body;
  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Message is required' });

  message = message.trim().substring(0, 8000);
  if (!message) return res.status(400).json({ error: 'Message cannot be empty' });

  const model = genAI.getGenerativeModel({ model: getChatModel(chatModel) });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    res.write(`data: ${JSON.stringify({ status: 'Searching your repository...' })}\n\n`);
    
    let context = '';
    if (repoUrl) {
      context = await retrieveContext(message, repoUrl, embeddingModel);
    }

    let systemPrompt = buildRagPrompt(context);

    let convoId = conversationId;
    let historyMessages: any[] = [];

    if (convoId) {
      const convo = await Conversation.findById(convoId);
      if (convo) {
        historyMessages = convo.messages.map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));
      }
      await Conversation.findByIdAndUpdate(convoId, {
        $push: { messages: { role: 'user', content: message } }
      });
    } else if (repoUrl) {
      const newConvo = new Conversation({
        userId: req.user.id,
        repoId: repoUrl,
        title: message.substring(0, 40) + (message.length > 40 ? '...' : ''),
        messages: [{ role: 'user', content: message }]
      });
      await newConvo.save();
      convoId = (newConvo._id as any).toString();
    }

    const chatInstance = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. I have the context and instructions.' }] },
        ...historyMessages
      ]
    });

    res.write(`data: ${JSON.stringify({ status: 'Generating response...' })}\n\n`);

    const result = await executeWithRetry(() => chatInstance.sendMessageStream(message));

    if (convoId) {
      res.write(`data: ${JSON.stringify({ conversationId: convoId })}\n\n`);
    }

    let fullAssistantResponse = '';
    for await (const chunk of (result as any).stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        fullAssistantResponse += chunkText;
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }
    }
    
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
};

export const onboarding = async (req: AuthenticatedRequest, res: Response) => {
  const { repoUrl, chatModel } = req.body;
  if (!repoUrl) return res.status(400).json({ error: 'Repo URL is required' });

  const model = genAI.getGenerativeModel({ model: getChatModel(chatModel) });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    res.write(`data: ${JSON.stringify({ status: 'Analyzing architecture...' })}\n\n`);

    const files = await Chunk.distinct('filePath', { repoUrl });
    const fileTree = files.join('\n');

    const readmeChunk = await Chunk.findOne({ repoUrl, filePath: { $regex: /README.md$/i } });
    const packageJsonChunk = await Chunk.findOne({ repoUrl, filePath: { $regex: /package.json$/i } });

    let contextData = `File Tree:\n${fileTree}\n\n`;
    if (readmeChunk) contextData += `README Context:\n${readmeChunk.content.substring(0, 1500)}\n\n`;
    if (packageJsonChunk) contextData += `Dependencies (package.json):\n${packageJsonChunk.content.substring(0, 1500)}\n\n`;

    const prompt = buildOnboardingPrompt(contextData);

    const newConvo = new Conversation({
      userId: req.user.id,
      repoId: repoUrl,
      title: 'Codebase Onboarding Guide',
      messages: [{ role: 'user', content: 'Generate an onboarding guide for this codebase.' }]
    });
    await newConvo.save();
    const convoId = (newConvo._id as any).toString();

    res.write(`data: ${JSON.stringify({ status: 'Writing onboarding guide...' })}\n\n`);
    res.write(`data: ${JSON.stringify({ conversationId: convoId })}\n\n`);

    const result = await executeWithRetry(() => model.generateContentStream(prompt));

    let fullAssistantResponse = '';
    for await (const chunk of (result as any).stream) {
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
};

export const bugTrace = async (req: AuthenticatedRequest, res: Response) => {
  const { repoUrl, stackTrace, chatModel } = req.body;
  if (!repoUrl || !stackTrace) return res.status(400).json({ error: 'Repo URL and stack trace are required' });

  const model = genAI.getGenerativeModel({ model: getChatModel(chatModel) });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    res.write(`data: ${JSON.stringify({ status: 'Analyzing stack trace...' })}\n\n`);

    const fileRegex = /([a-zA-Z0-9_\\-\\./\\\\]+\\.(?:js|jsx|ts|tsx|py|go|java|c|cpp|h|cs|rb|php))/gi;
    const matches = [...new Set(stackTrace.match(fileRegex) || [])];
    const searchTokens = matches.map((m: any) => m.split(/[/]/).pop());

    res.write(`data: ${JSON.stringify({ status: 'Fetching related files...' })}\n\n`);

    let contextData = '';
    if (searchTokens.length > 0) {
      const regexTokens = searchTokens.map((token: any) => token.replace(/[.*+?^${}()|[]]/g, '$&'));
      const searchRegex = new RegExp(`(${regexTokens.join('|')})$`, 'i');
      const relatedChunks = await Chunk.find({ repoUrl, filePath: { $regex: searchRegex } }).limit(10);
      
      for (const chunk of relatedChunks) {
        contextData += `### File: ${chunk.filePath} ###\n${chunk.content}\n\n`;
      }
    }
    if (!contextData) contextData = "No specific files identified from the stack trace.";

    const prompt = buildBugTracePrompt(stackTrace, contextData);

    const newConvo = new Conversation({
      userId: req.user.id,
      repoId: repoUrl,
      title: `Bug Trace: ${stackTrace.split('\n')[0].substring(0, 30)}...`,
      messages: [{ role: 'user', content: `Please trace this bug:\n\n${stackTrace}` }]
    });
    await newConvo.save();
    const convoId = (newConvo._id as any).toString();

    res.write(`data: ${JSON.stringify({ status: 'Tracing bug...' })}\n\n`);
    res.write(`data: ${JSON.stringify({ conversationId: convoId })}\n\n`);

    const result = await executeWithRetry(() => model.generateContentStream(prompt));

    let fullAssistantResponse = '';
    for await (const chunk of (result as any).stream) {
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
};

export const commitStory = async (req: AuthenticatedRequest, res: Response) => {
  const { repoUrl, commitCount = 20, chatModel } = req.body;
  if (!repoUrl) return res.status(400).json({ error: 'Repo URL is required' });

  const model = genAI.getGenerativeModel({ model: getChatModel(chatModel) });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    res.write(`data: ${JSON.stringify({ status: 'Fetching recent commits...' })}\n\n`);

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
       const parts = repoUrl.split('/');
       if(parts.length >= 2) {
         owner = parts[parts.length - 2];
         repo = parts[parts.length - 1];
       } else {
         throw new Error("Could not parse owner/repo from URL");
       }
    }
    repo = repo.replace(/\.git$/, '');
    const userToken = await getUserToken(req.user?.id);
    const token = userToken || process.env.GITHUB_TOKEN;
    const octokit = new Octokit(token ? { auth: token } : {});
    const commitsRes = await octokit.rest.repos.listCommits({ owner, repo, per_page: commitCount });
    const commits = commitsRes.data;
    
    res.write(`data: ${JSON.stringify({ status: 'Fetching commit diffs...' })}\n\n`);
    
    let commitHistoryText = '';
    for (let i = 0; i < Math.min(commits.length, commitCount); i++) {
      const commit = commits[i];
      let diffText = '';
      try {
        const commitDetails = await octokit.rest.repos.getCommit({ owner, repo, ref: commit.sha });
        if (commitDetails.data.files) {
          diffText = commitDetails.data.files.map((f: any) => {
            return `File: ${f.filename}\nStatus: ${f.status}\nChanges: +${f.additions} -${f.deletions}\nPatch: ${f.patch ? f.patch.substring(0, 500) + (f.patch.length > 500 ? '...' : '') : 'N/A'}`;
          }).join('\n\n');
        }
      } catch (err: any) {
        console.error(`Failed to fetch diff for commit ${commit.sha}`, err.message);
      }
      
      commitHistoryText += `### Commit ${commit.sha.substring(0, 7)} by ${commit.commit.author?.name} on ${commit.commit.author?.date} ###\n`;
      commitHistoryText += `Message: ${commit.commit.message}\n`;
      if (diffText) commitHistoryText += `Diff Summary:\n${diffText}\n`;
      commitHistoryText += `\n----------------------------------\n\n`;
    }

    const prompt = buildCommitStoryPrompt(owner, repo, commitCount, commitHistoryText);

    const newConvo = new Conversation({
      userId: req.user.id,
      repoId: repoUrl,
      title: 'Commit Story Generator',
      messages: [{ role: 'user', content: `Generate a Commit Story for the last ${commitCount} commits.` }]
    });
    await newConvo.save();
    const convoId = (newConvo._id as any).toString();

    res.write(`data: ${JSON.stringify({ status: 'Generating Commit Story narrative...' })}\n\n`);
    res.write(`data: ${JSON.stringify({ conversationId: convoId })}\n\n`);

    const result = await executeWithRetry(() => model.generateContentStream(prompt));

    let fullAssistantResponse = '';
    for await (const chunk of (result as any).stream) {
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
};

export const prReview = async (req: AuthenticatedRequest, res: Response) => {
  const { repoUrl, prNumber, message, conversationId, chatModel } = req.body;
  if (!repoUrl || !prNumber) return res.status(400).json({ error: 'Repo URL and PR Number are required' });

  const model = genAI.getGenerativeModel({ model: getChatModel(chatModel) });

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
    const userToken = await getUserToken(req.user?.id);
    const token = userToken || process.env.GITHUB_TOKEN;
    const octokit = new Octokit(token ? { auth: token } : {});
    const diffRes: any = await octokit.rest.pulls.get({
      owner, repo: repoName, pull_number: prNumber, mediaType: { format: 'diff' }
    });
    const prDiff = diffRes.data;
    
    res.write(`data: ${JSON.stringify({ status: 'Fetching repository context...' })}\n\n`);
    const filePaths = [...new Set([...prDiff.matchAll(/(?:\+\+\+ b\/|--- a\/)(.*)/g)].map((m: any) => m[1]))];
    
    let currentContext = '';
    if (filePaths.length > 0) {
      const searchTokens = filePaths.map((p: any) => p.split(/[/]/).pop().replace(/[.*+?^${}()|[]]/g, '$&'));
      if (searchTokens.length > 0) {
         const searchRegex = new RegExp(`(${searchTokens.join('|')})$`, 'i');
         const relatedChunks = await Chunk.find({ repoUrl, filePath: { $regex: searchRegex } }).limit(15);
         for (const chunk of relatedChunks) {
           currentContext += `### CURRENT MASTER FILE: ${chunk.filePath} ###\n${chunk.content}\n\n`;
         }
      }
    }

    let convoId = conversationId;
    let messages: any[] = [];

    if (convoId) {
      const convo = await Conversation.findById(convoId);
      if (convo) messages = convo.messages.map((m: any) => ({ role: m.role, content: m.content }));
    } else {
      const newConvo = new Conversation({
        userId: req.user.id, repoId: repoUrl, title: `PR #${prNumber} Review`, messages: []
      });
      await newConvo.save();
      convoId = (newConvo._id as any).toString();
    }
    
    res.write(`data: ${JSON.stringify({ conversationId: convoId })}\n\n`);

    const history = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }]
    }));

    const systemPrompt = buildPRReviewPrompt(prNumber, owner, repoName, prDiff, currentContext);

    const chatInstance = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: "Understood. I have the PR diff and context." }] },
        ...history
      ]
    });

    res.write(`data: ${JSON.stringify({ status: 'Analyzing PR and formulating response...' })}\n\n`);

    const result = await executeWithRetry(() => chatInstance.sendMessageStream(message));

    let fullAssistantResponse = '';
    for await (const chunk of (result as any).stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        fullAssistantResponse += chunkText;
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }
    }

    await Conversation.findByIdAndUpdate(convoId, {
      $push: { messages: [{ role: 'user', content: message }, { role: 'assistant', content: fullAssistantResponse }] }
    });

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('PR Review Error:', error);
    const errMsg = formatGeminiError(error, 'Failed to process PR review.');
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    res.end();
  }
};
