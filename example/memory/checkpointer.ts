/**
 * LCEL 链看 RunnableWithMessageHistory
Agent 看 checkpointer

这两者解决的是同一类问题：
怎么把前面的对话重新带回这一轮。

只是接入位置不一样。
 */

import { createAgent, summarizationMiddleware } from 'langchain'
import { MemorySaver } from '@langchain/langgraph'
import { ChatOpenAI } from '@langchain/openai'
import dotenv from 'dotenv'

dotenv.config({ path: new URL('../../.env.local', import.meta.url) })
const model = new ChatOpenAI({
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  },
})
// checkpointer 负责保存这条会话线程里的短期状态。
const checkpointer = new MemorySaver()

const agent = createAgent({
  model,
  tools: [],
  // 对话变长以后，用 middleware 帮你做摘要压缩。
  middleware: [
    summarizationMiddleware({
      model,
      trigger: { tokens: 4000 },
      keep: { messages: 20 },
    }),
  ],
  checkpointer,
})

const config = {
  configurable: {
    // 同一个 thread_id，就会读到同一段短期记忆。
    thread_id: 'companion-user-001',
  },
}

await agent.invoke(
  {
    messages: [{ role: 'user', content: '我今天加班到快 11 点' }],
  },
  config,
)

await agent.invoke(
  {
    messages: [{ role: 'user', content: '还是上次那个需求，改了好几版了' }],
  },
  config,
)

const result = await agent.invoke(
  {
    messages: [{ role: 'user', content: '你还记得我刚才在烦什么吗？' }],
  },
  config,
)

console.log(result.messages.at(-1)?.content)


