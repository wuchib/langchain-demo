import {
  StateGraph,
  StateSchema,
  MessagesValue,
  START,
  END,
} from '@langchain/langgraph'
import type { GraphNode } from '@langchain/langgraph'
import { MemorySaver } from '@langchain/langgraph'
import { ChatOpenAI } from '@langchain/openai'
import dotenv from 'dotenv'
dotenv.config({ path: new URL('../../../.env.local', import.meta.url) })

const model = new ChatOpenAI({
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  },
})
const State = new StateSchema({
  messages: MessagesValue,
})

// const model = new ChatOpenAI({ model: 'gpt-4.1-mini' })

const callModel: GraphNode<typeof State> = async (state) => {
  const response = await model.invoke(state.messages)
  return { messages: [response] }
}

const graph = new StateGraph(State)
  .addNode('callModel', callModel)
  .addEdge(START, 'callModel')
  .addEdge('callModel', END)
  .compile({ checkpointer: new MemorySaver() })

// 同一个 thread_id
const config = { configurable: { thread_id: 'chat-001' } }

// 第一轮
const r1 = await graph.invoke(
  { messages: [{ role: 'user', content: '我叫小明，我是前端工程师' }] },
  config,
)
console.log(r1.messages.at(-1)?.content)
// → 你好小明！很高兴认识你...

// 第二轮（同一个 thread_id，上下文自动累积）
const r2 = await graph.invoke(
  { messages: [{ role: 'user', content: '我叫什么？我做什么工作？' }] },
  config,
)
console.log(r2.messages.at(-1)?.content)
// → 你叫小明，你是一名前端工程师。 ← 记住了！

// 换一个 thread_id = 全新的对话
const r3 = await graph.invoke(
  { messages: [{ role: 'user', content: '我叫什么？' }] },
  { configurable: { thread_id: 'chat-002' } },
)
console.log(r3.messages.at(-1)?.content)
// → 我不知道你叫什么。 ← 不同 thread，互不影响