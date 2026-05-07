# DevMind 

> An AI-powered developer productivity suite — ask your codebase questions, get automated PR reviews, convert screenshots to code, and speak to your repos.

---

## What is DevMind?

DevMind is a full-stack MERN application that indexes any GitHub repository and gives you an AI-powered interface to interact with it. Connect a repo and you get:

- **Codebase chat** — ask natural language questions, get answers with exact file citations
- **Automated PR reviews** — AI reviews every pull request and posts structured comments directly to GitHub
- **Screenshot to code** — drag a UI screenshot, get production-ready React + Tailwind code
- **Voice input** — speak your question, get an answer from your codebase

---



## Tech Stack

**Frontend**
- React 18 + Vite
- Tailwind CSS
- Monaco Editor (`@monaco-editor/react`)
- Web Speech API (native browser)

**Backend**
- Node.js + Express.js
- Server-Sent Events (SSE) for streaming
- JWT authentication
- express-rate-limit

**Database**
- MongoDB Atlas (M0 free tier)
- MongoDB Atlas Vector Search

**AI / ML**
- Google Gemini 1.5 Flash — LLM + vision
- Gemini `text-embedding-004` — embeddings
- Groq Whisper large-v3 — speech to text (fallback)
- Web Speech API — browser-native STT

**Integrations**
- GitHub REST API via Octokit
- GitHub Webhooks

**Deployment**
- Vercel (frontend)
- Render.com (backend)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  React Frontend                      │
│   Chat UI · Code Editor · Voice · File Upload        │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP / SSE
┌──────────────────────▼──────────────────────────────┐
│              Express.js API Gateway                  │
│        Auth · Rate Limiting · Routing                │
└──────┬───────────┬──────────┬───────────┬───────────┘
       │           │          │           │
  ┌────▼────┐ ┌────▼────┐ ┌──▼──────┐ ┌──▼──────┐
  │ Indexer │ │RAG Chat │ │PR Agent │ │ Vision  │
  │         │ │         │ │         │ │ + Voice │
  └────┬────┘ └────┬────┘ └──┬──────┘ └──┬──────┘
       │           │          │           │
┌──────▼───────────▼──┐  ┌───▼──────┐ ┌──▼──────────┐
│   MongoDB Atlas     │  │  GitHub  │ │Gemini Vision│
│   + Vector Search   │  │  API     │ │+ Whisper    │
└─────────────────────┘  └──────────┘ └─────────────┘
                    ▲
         ┌──────────┴──────────┐
         │   Gemini 1.5 Flash  │
         │   + Embeddings API  │
         └─────────────────────┘
```

### How RAG works in DevMind

```
User question
     │
     ▼
Embed question        ← Gemini text-embedding-004
     │
     ▼
Vector search         ← MongoDB $vectorSearch (cosine similarity)
     │
     ▼
Top 5 relevant        ← code chunks with file + line metadata
code chunks
     │
     ▼
Build prompt          ← inject chunks as context
     │
     ▼
Gemini generates      ← grounded answer, no hallucination
answer
     │
     ▼
Stream via SSE        ← token-by-token to React frontend
```

---

## Project Structure

```
devmind/
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatMessage.jsx     # Single message bubble
│   │   │   ├── CitationBadge.jsx   # File reference tag
│   │   │   ├── RepoInput.jsx       # GitHub URL input + connect
│   │   │   ├── VoiceInput.jsx      # Mic button + Web Speech
│   │   │   └── ScreenshotUpload.jsx # Drag-drop + preview
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
│
└── server/                     # Express backend
    ├── models/
    │   ├── User.js                 # JWT auth schema
    │   └── Chunk.js                # Code chunk + embedding schema
    ├── routes/
    │   ├── auth.js                 # register / login
    │   ├── repos.js                # index a repo
    │   ├── chat.js                 # RAG chat endpoint
    │   ├── vision.js               # screenshot → code
    │   └── webhook.js              # GitHub PR events
    ├── services/
    │   ├── indexer.js              # clone → chunk → embed → save
    │   ├── retriever.js            # embed query → $vectorSearch
    │   └── rag.js                  # retriever + Gemini pipeline
    ├── middleware/
    │   └── auth.js                 # JWT verification
    ├── index.js                    # app entry point
    └── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com) account (free API key)
- A [MongoDB Atlas](https://mongodb.com/atlas) account (free M0 cluster)
- A [GitHub](https://github.com) account

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/devmind.git
cd devmind
```

### 2. Set up the backend

```bash
cd server
npm install
```

Create `server/.env`:

```env
PORT=5000
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_jwt_secret_key_here
GEMINI_API_KEY=your_google_ai_studio_api_key
GITHUB_WEBHOOK_SECRET=your_webhook_secret
```

Start the server:

```bash
npm run dev
```

### 3. Set up the frontend

```bash
cd client
npm install
```

Create `client/.env`:

```env
VITE_API_URL=http://localhost:5000
```

Start the client:

```bash
npm run dev

```

### 4. Set up MongoDB Atlas Vector Search

After running the indexer for the first time:

1. Go to your Atlas cluster → **Search Indexes**
2. Click **Create Search Index** → **JSON Editor**
3. Select your `chunks` collection and paste:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 768,
      "similarity": "cosine"
    }
  ]
}
```

### 5. Set up GitHub PR webhook (optional)

```bash
# Install ngrok for local development
npm install -g ngrok
ngrok http 5000
```

Copy the ngrok URL → GitHub repo → **Settings → Webhooks → Add webhook**:
- Payload URL: `https://your-ngrok-url.ngrok.io/webhook/github`
- Content type: `application/json`
- Secret: same as `GITHUB_WEBHOOK_SECRET` in your `.env`
- Events: select **Pull requests**

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, get JWT |
| POST | `/api/repos/index` | Index a GitHub repo |
| POST | `/api/chat` | RAG chat (SSE stream) |
| POST | `/api/vision` | Screenshot → React code |
| POST | `/webhook/github` | GitHub PR event receiver |

---

## AI Concepts Used

| Concept | Where | Description |
|---------|-------|-------------|
| **Embeddings** | Indexer + Retriever | Convert text to 768-dim vectors representing meaning |
| **Vector search** | MongoDB $vectorSearch | Find semantically similar chunks via cosine similarity |
| **RAG** | rag.js | Retrieve relevant context before generating answers |
| **Prompt engineering** | All features | System prompts, few-shot examples, structured JSON output |
| **Agentic workflow** | PR bot | Perceive → decide → act without human involvement |
| **Structured outputs** | PR review | Force LLM to return machine-parseable JSON |
| **Multimodal AI** | Vision feature | Image + text input to the same model |
| **SSE streaming** | Chat + vision | Stream tokens to the browser in real-time |
| **Speech AI** | Voice input | Browser STT chained into the RAG pipeline |



---

## Free Tier Limits

All services used have a free tier sufficient for a portfolio project:

| Service | Free limit | Used for |
|---------|-----------|----------|
| Google AI Studio | 15 req/min | LLM + embeddings + vision |
| MongoDB Atlas M0 | 512MB storage | Chunks + users |
| Render.com | 750 hrs/month | Express server |
| Vercel | Unlimited | React frontend |
| Groq | Free tier | Whisper STT fallback |

**Total monthly cost: ₹0**

---

## Contributing

Pull requests welcome. For major changes, open an issue first.

```bash
git checkout -b feature/your-feature
git commit -m 'Add your feature'
git push origin feature/your-feature
```

---
