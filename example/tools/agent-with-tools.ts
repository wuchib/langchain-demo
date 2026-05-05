import { createAgent } from 'langchain'
import { getWeather, createReminder } from './companion-tools'
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
const agent = createAgent({
  model,
  tools: [getWeather, createReminder],
  systemPrompt: '你是用户的生活助理，能聊天，也能在必要时调用工具。',
})

const result = await agent.invoke({
  messages: [
    {
      role: 'user',
      content: '帮我看看明天上海天气，如果下雨就提醒我带伞。',
    },
  ],
})

// Agent 已经把前面的工具循环跑完了。
// 这里直接读取最后一条消息，就是这一轮最终回复。
console.log(result.messages.at(-1)?.text)