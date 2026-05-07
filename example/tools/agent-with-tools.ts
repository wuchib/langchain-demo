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



/**
 * 这一段很适合调试。
当你怀疑 Agent 为什么没调工具、或者调错了工具，先看 result.messages 往往比先改 Prompt 更有用。
 */
for (const message of result.messages) {
  // 这里通常能看到：
  // user 消息
  // assistant 发起的工具调用
  // tool 返回结果
  // assistant 最终回复
  console.log(message.getType(), message.text ?? message.content)
}