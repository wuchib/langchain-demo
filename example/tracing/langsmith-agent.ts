import { ChatOpenAI } from '@langchain/openai'
import { createAgent, tool } from 'langchain'
import dotenv from 'dotenv'
import * as z from 'zod'

dotenv.config({ path: new URL('../../.env.local', import.meta.url) })

// LangSmith 的 LangChain 集成主要靠环境变量自动开启。
// .env.local 示例：
// LANGSMITH_API_KEY=lsv2_...
// LANGSMITH_TRACING=true
// LANGSMITH_PROJECT=langchain-demo
// LANGSMITH_ENDPOINT=https://api.smith.langchain.com
if (!process.env.LANGSMITH_API_KEY) {
  console.log('缺少 LANGSMITH_API_KEY，已跳过 LangSmith 上报示例。')
  process.exit(0)
}

process.env.LANGSMITH_TRACING ??= 'true'
process.env.LANGSMITH_ENDPOINT ??= 'https://api.smith.langchain.com'
process.env.LANGSMITH_PROJECT ??= 'langchain-demo'

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

const agent = createAgent({
  model,
  tools: [getWeather, createReminder],
  systemPrompt: '你是用户的生活助理，会在需要时调用工具。',
})

const result = await agent.invoke(
  {
    messages: [
      {
        role: 'user',
        content: '帮我看看明天上海天气。如果下雨，提醒我早上出门带伞。',
      },
    ],
  },
  {
    // 这些运行信息会进入 LangSmith，方便按示例、环境、用户等维度过滤。
    runName: 'langsmith-weather-agent',
    tags: ['example', 'tracing', 'langsmith'],
    metadata: {
      userId: 'demo-user-001',
      example: 'agent-with-tools',
    },
  },
)

console.log(result.messages.at(-1)?.text)
console.log(`LangSmith trace 已发送到项目：${process.env.LANGSMITH_PROJECT}`)
