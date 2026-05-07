import { createAgent, tool } from 'langchain'
import * as z from 'zod'
import { TraceCallbackHandler } from './trace-handler'
import dotenv from 'dotenv'
import { ChatOpenAI } from '@langchain/openai'

dotenv.config({ path: new URL('../../.env.local', import.meta.url) })

const model = new ChatOpenAI({
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  },
})
const getWeather = tool(
  async ({ city }) => `${city}：明天小雨，17-22 度`,
  {
    name: 'get_weather',
    description: '查询某个城市未来的天气情况',
    schema: z.object({
      city: z.string().describe('要查询天气的城市名'),
    }),
  },
)

const createReminder = tool(
  async ({ content, time }) => `提醒已创建：${time} - ${content}`,
  {
    name: 'create_reminder',
    description: '帮用户创建一个提醒事项',
    schema: z.object({
      content: z.string().describe('提醒内容'),
      time: z.string().describe('提醒时间'),
    }),
  },
)

const sendMessage = tool(
  async ({ text }) => `已发送给用户：${text}`,
  {
    name: 'send_message',
    description: '把一段结果发送给用户',
    schema: z.object({
      text: z.string().describe('要发送的内容'),
    }),
  },
)

const agent = createAgent({
  model,
  tools: [getWeather, createReminder, sendMessage],
  systemPrompt: '你是用户的生活助理，会在需要时连续调用工具。',
})

// 每次请求创建一个新的 handler 实例（等价于每次请求创建一个新的 TraceContext）
const handler = new TraceCallbackHandler()

const result = await agent.invoke(
  {
    messages: [
      {
        role: 'user',
        content: '帮我看看明天上海天气。如果下雨就提醒我带伞，再把结果顺手发给我。',
      },
    ],
  },
  {
    callbacks: [handler],
  },
)

// 调用结束后，handler 里已经自动收集了所有 Span
const trace = handler.getTraceSummary()
console.log(`共 ${trace.spanCount} 个 Span：`)
trace.spans.forEach(span => {
  console.log(
    `  [${span.status}] ${span.name} - ${span.duration}ms`
  )
})