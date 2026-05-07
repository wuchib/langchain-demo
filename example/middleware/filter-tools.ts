import * as z from 'zod'
import { createAgent, createMiddleware, tool } from 'langchain'
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
      date: z.string().describe('要查询的日期'),
    }),
  },
)

const cancelSchedule = tool(
  async ({ date }) => `${date}：日程取消申请已提交`,
  {
    name: 'cancel_schedule',
    description: '取消用户某一天的重要日程',
    schema: z.object({
      date: z.string().describe('要取消的日期'),
    }),
  },
)

const quietHoursMiddleware = createMiddleware({
  name: 'QuietHoursToolFilter',
  contextSchema,
  wrapModelCall: (request, handler) => {
    // 白天照常放行。
    if (!request.runtime.context.isQuietHours) {
      return handler(request)
    }

    // 深夜时，把高风险工具先从这一轮可见工具里拿掉。
    const filteredTools = request.tools.filter((tool) => tool.name !== 'cancel_schedule')

    return handler({
      ...request,
      tools: filteredTools,
    })
  },
})

const agent = createAgent({
  model,
  tools: [querySchedule, cancelSchedule],
  contextSchema,
  middleware: [quietHoursMiddleware],
})

const result = await agent.invoke(
  {
    messages: [
      {
        role: 'user',
        content: '帮我把明天的安排都取消掉。',
      },
    ],
  },
  {
    context: { isQuietHours: true },
  },
)

console.log(result.messages.at(-1)?.text)