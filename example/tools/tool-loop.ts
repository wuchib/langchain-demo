import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, type BaseMessage } from '@langchain/core/messages'
import type { StructuredToolInterface } from '@langchain/core/tools'
import { getWeather, createReminder } from './companion-tools'
import dotenv from 'dotenv'

const tools: StructuredToolInterface[] = [getWeather, createReminder]
const toolMap = new Map(tools.map(tool => [tool.name, tool]))

dotenv.config({ path: new URL('../../.env.local', import.meta.url) })

const model = new ChatOpenAI({
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  },
})

// 这里只是把工具定义交给模型。
// 到这一步为止，工具还没有被真正执行。
const modelWithTools = model.bindTools(tools)

const messages: BaseMessage[] = [
  new HumanMessage('帮我看看明天上海天气，如果下雨就提醒我带伞。'),
]

// 第一步：模型先决定要不要调工具。
// 如果它觉得需要，会先返回 tool_calls。
const aiMessage = await modelWithTools.invoke(messages)
messages.push(aiMessage)

// 第二步：你的程序根据 tool_calls 真正执行工具。
for (const toolCall of aiMessage.tool_calls ?? []) {
  const selectedTool = toolMap.get(toolCall.name)

  if (!selectedTool) {
    throw new Error(`未知工具：${toolCall.name}`)
  }

  // selectedTool.invoke(...) 会执行工具，并返回一个 ToolMessage。
  // 这个 ToolMessage 里会带上 tool_call_id，模型后面靠它来对上这次调用。
  const toolMessage = await selectedTool.invoke(toolCall)
  messages.push(toolMessage)
}

// 第三步：把工具结果再交给模型。
// 这一次拿到的，才是给用户看的最终回复。
const finalResponse = await modelWithTools.invoke(messages)

console.log(finalResponse.text)
