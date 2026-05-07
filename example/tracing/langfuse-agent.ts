import { langfuseSdk } from './langfuse-instrumentation'
import { ChatOpenAI } from '@langchain/openai'
import { CallbackHandler } from '@langfuse/langchain'
import { createAgent, tool } from 'langchain'
import dotenv from 'dotenv'
import * as z from 'zod'

dotenv.config({ path: new URL('../../.env.local', import.meta.url) })

// Langfuse 通过 CallbackHandler 接入 LangChain 的 callback 生命周期。
// .env.local 示例：
// LANGFUSE_PUBLIC_KEY=pk-lf-...
// LANGFUSE_SECRET_KEY=sk-lf-...
// LANGFUSE_BASE_URL=https://cloud.langfuse.com
if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
  console.log('缺少 LANGFUSE_PUBLIC_KEY 或 LANGFUSE_SECRET_KEY，已跳过 Langfuse 上报示例。')
  process.exit(0)
}

process.env.LANGFUSE_BASE_URL ??= 'https://cloud.langfuse.com'

const model = new ChatOpenAI({
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  },
})

const searchCalendar = tool(
  async ({ date }) => `${date}：10:00 产品评审，15:00 看牙医`,
  {
    name: 'search_calendar',
    description: '查询某一天的日程安排',
    schema: z.object({
      date: z.string().describe('要查询的日期，例如 今天、明天、下周一'),
    }),
  },
)

const createTodo = tool(
  async ({ title }) => `待办已创建：${title}`,
  {
    name: 'create_todo',
    description: '创建一个待办事项',
    schema: z.object({
      title: z.string().describe('待办标题'),
    }),
  },
)

const langfuseHandler = new CallbackHandler({
  // 这些字段会落到 trace 维度，适合排查某个用户或会话的问题。
  userId: 'demo-user-001',
  sessionId: 'demo-session-langfuse',
  tags: ['example', 'tracing', 'langfuse'],
  version: 'demo-v1',
  traceMetadata: {
    feature: 'calendar-agent',
  },
})

const agent = createAgent({
  model,
  tools: [searchCalendar, createTodo],
  systemPrompt: '你是用户的日程助理，会在必要时查询日程并创建待办。',
})

try {
  const result = await agent.invoke(
    {
      messages: [
        {
          role: 'user',
          content: '帮我看一下明天日程。如果有看牙医，帮我加一个提前带医保卡的待办。',
        },
      ],
    },
    {
      callbacks: [langfuseHandler],
      runName: 'langfuse-calendar-agent',
      // 也可以在单次调用里覆盖 trace 归属信息，适合请求级别的用户和会话。
      metadata: {
        langfuseUserId: 'demo-user-001',
        langfuseSessionId: 'demo-session-langfuse',
      },
    },
  )

  console.log(result.messages.at(-1)?.text)
  console.log(`Langfuse trace id：${langfuseHandler.last_trace_id ?? '请到 Langfuse Trace Table 查看'}`)
} finally {
  // 短脚本结束前 shutdown，确保缓存中的 span 被 flush 到 Langfuse。
  await langfuseSdk?.shutdown()
}
