import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { ChatOpenAI } from '@langchain/openai'
import { MemorySaver } from '@langchain/langgraph'
import dotenv from 'dotenv'
import { isAIMessage } from '@langchain/core/messages'
import type { StructuredToolInterface } from '@langchain/core/tools'
import tools from './tools.js'
dotenv.config({ path: new URL('../../../.env.local', import.meta.url) })
const model = new ChatOpenAI({
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  },
})
// 一行搞定：模型 + 工具 + Checkpointer
const agent = createReactAgent({
  model,
  tools,
  checkpointer: new MemorySaver(),
})

// 用法和手动构建的完全一样
const result = await agent.invoke(
  { messages: [{ role: 'user', content: '北京天气怎么样？' }] },
  { configurable: { thread_id: 'quick-001' } },
)