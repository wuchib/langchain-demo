import { createAgent } from 'langchain'
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory'
import { Document } from '@langchain/core/documents'
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";
dotenv.config({ path: new URL("../../.env.local", import.meta.url) });

const model = new ChatOpenAI({
  model: "deepseek-chat",
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
  },
});
const embeddings = new HuggingFaceTransformersEmbeddings({
  model: "Xenova/all-MiniLM-L6-v2",
})

// 知识库里的内容先放进向量库。
// 这一层只负责“存”和“查”，还没有开始回答。
const vectorStore = await MemoryVectorStore.fromDocuments(
  [
    new Document({
      pageContent: '退款政策：购买后 30 天内可申请无条件退款。超过 30 天需要提供商品质量问题证明。',
      metadata: { source: 'policy.pdf', topic: 'refund' },
    }),
    new Document({
      pageContent: '会员等级：消费满 1000 元升银卡，满 5000 元升金卡。',
      metadata: { source: 'policy.pdf', topic: 'membership' },
    }),
    new Document({
      pageContent: '客服工作时间：周一到周五 9 点到 18 点。',
      metadata: { source: 'policy.pdf', topic: 'support' },
    }),
  ],
  embeddings,
)

const agent = createAgent({
  model,
  tools: [],
})

function formatDocs(docs: Document[]) {
  return docs
    .map((doc, index) => {
      // 这里把检索结果转成更适合拼进 system 的格式。
      return `资料 ${index + 1}：${doc.pageContent}`
    })
    .join('\n\n')
}

async function runRAG(question: string) {
  // 1. 先检索最相关的资料块。
  const docs = await vectorStore.similaritySearch(question, 3)

  // 2. 再把检索结果转成 Agent 更容易消费的上下文。
  const context = formatDocs(docs)

  const result = await agent.invoke({
    messages: [
      {
        // 这层 system 的作用，是把回答范围限制在检索结果里。
        role: 'system',
        content: `你是公司的 AI 助手。

回答问题时，只能优先依据下面的参考资料。
如果资料不足，就明确说资料里没有，不要自己补。

参考资料：
${context}`,
      },
      {
        // 这里还是用户的原始提问，不做改写。
        role: 'user',
        content: question,
      },
    ],
  })

  return {
    answer: result.messages.at(-1)?.text ?? '',
    docs,
  }
}

const result = await runRAG('退款超过 30 天怎么办？')
// answer 是最终回答，docs 是这次检索真正命中的资料。
console.log(result.answer)