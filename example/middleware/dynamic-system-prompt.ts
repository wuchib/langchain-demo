import * as z from 'zod'
import { createAgent, dynamicSystemPromptMiddleware, tool } from 'langchain'
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
const contextSchema = z.object({
  isQuietHours: z.boolean(),
})

const querySchedule = tool(
  async ({ date }) => `${date}：10:00 产品评审会，14:00 和小李 1v1`,
  {
    name: 'query_schedule',
    description: '查询用户某一天的日程安排',
    schema: z.object({
      date: z.string().describe('要查询的日期，例如 今天、明天、后天'),
    }),
  },
)

const agent = createAgent({
  model,
  tools: [querySchedule],
  contextSchema,
  middleware: [
    dynamicSystemPromptMiddleware<z.infer<typeof contextSchema>>((state, runtime) => {
      // 这里不是改用户消息，而是按运行时上下文决定这一轮的行为准则。
      // 同一个 Agent，在不同场景里可以临时换一套说话方式。
      if (runtime.context.isQuietHours) {
        return `
你是用户的深夜陪伴助手。
回复要短一点，先照顾用户情绪。
如果请求涉及高风险操作，不要直接执行，先提醒用户白天再确认一次。
        `.trim()
      }

      return `
你是用户的生活助理。
在需要时可以查询日程并提供简洁帮助。
      `.trim()
    }),
  ],
})

const result = await agent.invoke(
  {
    messages: [
      {
        role: 'user',
        content: '帮我看看明天的安排。',
      },
    ],
  },
  {
    // 这份 context 不会直接出现在消息里，
    // 但 middleware 可以在运行时读到它。
    context: { isQuietHours: true },
  },
)

console.log(result.messages.at(-1)?.text)