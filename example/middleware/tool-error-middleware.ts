import { createAgent, createMiddleware, ToolMessage, tool } from 'langchain'
import * as z from 'zod'
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
const getWeather = tool(
  async ({ city }) => {
    // 这里故意模拟外部服务出错。
    throw new Error(`天气服务暂时不可用：${city}`)
  },
  {
    name: 'get_weather',
    description: '查询某个城市未来的天气情况',
    schema: z.object({
      city: z.string().describe('要查询天气的城市名'),
    }),
  },
)

const handleToolErrors = createMiddleware({
  name: 'HandleToolErrors',
  wrapToolCall: async (request, handler) => {
    try {
      // 正常情况下，工具还是按原样执行。
      return await handler(request)
    } catch (error) {
      // 报错时，不直接把整轮调用打断。
      // 这里返回一条 ToolMessage，让模型知道“工具失败了”，再自己组织回复。
      return new ToolMessage({
        content: `工具调用失败，请先不要继续依赖这个结果。错误信息：${String(error)}`,
        tool_call_id: request.toolCall.id!,
      })
    }
  },
})

const agent = createAgent({
  model,
  tools: [getWeather],
  middleware: [handleToolErrors],
})

const result = await agent.invoke({
  messages: [
    {
      role: 'user',
      content: '帮我看看明天上海天气。',
    },
  ],
})

console.log(result.messages.at(-1)?.text)