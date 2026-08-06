const Conversation = require('../models/Conversation');
const Chunk = require('../models/Chunk');
const { genAI, getChatModel, formatGeminiError } = require('../utils/gemini');
const { executeWithRetry } = require('../utils/retry');

const techDebt = async (req, res) => {
  const { repoUrl, chatModel } = req.body;
  if (!repoUrl) return res.status(400).json({ error: 'Repo URL is required' });

  const model = genAI.getGenerativeModel({ model: getChatModel(chatModel) });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    res.write(`data: ${JSON.stringify({ status: 'Analyzing entire codebase...' })}\n\n`);

    const allChunks = await Chunk.find({ repoUrl }).select('filePath content -_id').lean();
    let fullContext = '';
    
    for (const chunk of allChunks) {
      if (chunk.filePath.match(/.(min.js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i)) continue;
      fullContext += `### FILE: ${chunk.filePath} ###\n${chunk.content}\n\n`;
    }

    if (fullContext.length > 600000) {
      fullContext = fullContext.substring(0, 600000) + "\n\n...[TRUNCATED DUE TO SIZE]...";
      res.write(`data: ${JSON.stringify({ warning: 'Your codebase is very large. Only the first ~600,000 characters were sent to the AI to fit within standard Free Tier API limits. Some files may have been omitted from this analysis.' })}\n\n`);
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
      userId: req.user.id,
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
    const activeModel = getChatModel(chatModel);
    const errMsg = formatGeminiError(error, 'Failed to generate Tech Debt report.', activeModel);
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    res.end();
  }
};

module.exports = {
  techDebt
};
