/**
 * 完整 RAG 示例：
 * 1. 读取 PDF
 * 2. 切成适合检索的小块
 * 3. 用本地 embedding 建内存向量库
 * 4. 根据对话历史重写用户问题
 * 5. 检索相关资料
 * 6. 把资料交给模型生成回答
 */

import dotenv from 'dotenv'
import { AIMessage } from '@langchain/core/messages'
import { Document } from '@langchain/core/documents'
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers'
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory'
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { ChatOpenAI } from '@langchain/openai'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// 读取 DeepSeek API Key。
// 这里用 .env.local，是为了和项目里其他示例保持一致。
dotenv.config({ path: new URL('../../.env.local', import.meta.url) })

// ESM 里没有 CommonJS 的 __dirname。
// 所以用 import.meta.url 反推出当前脚本所在目录，再拼出 PDF 的绝对路径。
// 这样无论你从项目根目录还是别的目录执行脚本，都能找到正确的 PDF。
const currentDir = dirname(fileURLToPath(import.meta.url))
const pdfPath = join(currentDir, '../doc-loader/入门前端.pdf')

// ChatOpenAI 这里只是复用了 OpenAI 兼容协议。
// 真正调用的是 DeepSeek，因为 baseURL 指向了 DeepSeek API。
// 这个模型会做两件事：
// 1. 把用户的追问改写成完整检索问题
// 2. 根据检索资料生成最终答案
const model = new ChatOpenAI({
  model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  },
})

const embeddings = new HuggingFaceTransformersEmbeddings({
  // 本地 embedding 模型，不需要 OpenAI API Key。
  // 它负责把“文档块”和“用户问题”都变成向量。
  // 同一个向量空间里，语义越接近的文本，向量距离通常越近。
  model: 'Xenova/all-MiniLM-L6-v2',
})

function messageText(message: AIMessage) {
  // LangChain 的模型返回值不一定永远是纯字符串。
  // 有些模型可能返回多段 content，例如 text、tool_use 等。
  // 这个小工具把 AIMessage 稳定整理成一段字符串，方便后面打印和拼 prompt。
  if (typeof message.content === 'string') {
    return message.content.trim()
  }

  return message.content
    .map((part) => {
      if (part.type === 'text') {
        return part.text
      }

      return ''
    })
    .join('')
    .trim()
}

async function createKnowledgeBase() {
  // Loader 的职责：把外部文件读成 LangChain 的 Document[]。
  // PDFLoader 默认会按页读取，pageContent 是正文，metadata 里会保留 source、页码等信息。
  const loader = new PDFLoader(pdfPath)
  const rawDocs = await loader.load()

  // Splitter 的职责：把长文档切成更小的 chunk。
  // 向量检索不适合直接拿整本 PDF 去比，因为内容太长时语义会变得很散。
  // chunkSize 控制每块最大字符数，chunkOverlap 让相邻块保留一点重叠，减少上下文被切断的问题。
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 600,
    chunkOverlap: 100,
  })

  // chunks 仍然是 Document[]。
  // splitDocuments 会把原始 Document 的 metadata 继续带下去，所以检索后还能知道来源页码。
  const chunks = await splitter.splitDocuments(rawDocs)

  // VectorStore 的职责：保存“文档块 + 对应向量”，并提供相似度搜索。
  // MemoryVectorStore.fromDocuments 会在内部调用 embeddings.embedDocuments。
  // 真实项目里可以换成 Chroma、Milvus、pgvector、Pinecone 等持久化向量库。
  return MemoryVectorStore.fromDocuments(chunks, embeddings)
}

async function rewriteQuery(history: string[], question: string) {
  // 为什么要查询重写：
  // 用户在多轮对话里经常说“那后面呢”“第二个呢”。
  // 这种句子单独拿去检索，缺少主语，向量库可能不知道要找什么。
  // 所以先把它补成完整问题，再进入向量检索。
  const prompt = `你是 RAG 检索前的查询改写器。

请根据对话历史，把用户最后一句改写成一个独立、完整、适合向量检索的问题。
不要回答问题，不要解释，只输出改写后的检索问题。

对话历史：
${history.length > 0 ? history.join('\n') : '无'}

用户最后一句：
${question}`

  const result = await model.invoke(prompt)
  return messageText(result)
}

function formatDocs(docs: Document[]) {
  // 把检索命中的 Document[] 整理成模型容易读的文本。
  // 这里显式写出资料编号、来源、页码，是为了让最终回答可以引用依据。
  return docs
    .map((doc, index) => {
      const pageNumber = doc.metadata?.loc?.pageNumber ?? '未知页'
      const source = doc.metadata?.source ?? '未知来源'

      return `资料 ${index + 1}
来源：${source}
页码：${pageNumber}
内容：
${doc.pageContent}`
    })
    .join('\n\n---\n\n')
}

async function answerWithRAG(input: {
  history: string[]
  question: string
  vectorStore: MemoryVectorStore
}) {
  // 多轮对话里，用户常会说“那这个呢”“第二个怎么做”。
  // 先重写问题，可以让检索命中更稳定。
  const rewrittenQuestion = await rewriteQuery(input.history, input.question)

  // 用改写后的问题做检索，而不是直接用用户最后一句。
  // similaritySearch 内部会调用 embeddings.embedQuery，把检索问题转成向量。
  // 然后它会和建库时保存的文档向量做相似度比较，取最相近的 3 个 chunk。
  const docs = await input.vectorStore.similaritySearch(rewrittenQuestion, 3)
  const context = formatDocs(docs)

  // 这一步是 RAG 的 Generate 阶段。
  // 模型不会直接凭记忆回答，而是被要求只根据 context 里的资料回答。
  // 这能降低幻觉，也方便你把答案追溯到具体文档块。
  const answerPrompt = `你是一个严谨的 RAG 问答助手。

请只根据下面的参考资料回答用户问题。
如果参考资料里没有答案，就说“资料里没有找到明确答案”。
回答要简洁，并在最后列出使用到的资料编号。

参考资料：
${context}

用户原始问题：
${input.question}

改写后的检索问题：
${rewrittenQuestion}`

  const answer = await model.invoke(answerPrompt)

  return {
    rewrittenQuestion,
    docs,
    answer: messageText(answer),
  }
}

if (!process.env.DEEPSEEK_API_KEY) {
  // 本地 embedding 不需要 key，但最后的“生成回答”和“查询重写”仍然要调用 DeepSeek。
  throw new Error('缺少 DEEPSEEK_API_KEY，请先在 .env.local 里配置 DeepSeek API Key。')
}

// 建库阶段。
// 在这个 demo 里，每次运行都会重新读 PDF、切块、生成 embedding、写入内存向量库。
// 真实应用通常会把这一步做成离线任务，并把向量保存到持久化数据库。
const vectorStore = await createKnowledgeBase()

// 查询阶段。
// history 模拟前几轮对话，question 模拟用户当前这句不完整追问。
const result = await answerWithRAG({
  vectorStore,
  history: [
    '用户：前端入门需要先学什么？',
    '助手：可以先从 HTML、CSS 和 JavaScript 的基础概念开始。',
  ],
  question: '那后面怎么继续？',
})

console.log('改写后的检索问题：')
console.log(result.rewrittenQuestion)

console.log('\n命中的资料：')
result.docs.forEach((doc, index) => {
  // 打印命中的 chunk，方便你观察“模型到底是基于哪些资料回答的”。
  // 这里只截取前 120 个字符，避免整段 PDF 内容刷屏。
  console.log(`资料 ${index + 1}，页码：${doc.metadata?.loc?.pageNumber ?? '未知页'}`)
  console.log(doc.pageContent.slice(0, 120).replace(/\s+/g, ' '))
})

console.log('\n最终回答：')
console.log(result.answer)
