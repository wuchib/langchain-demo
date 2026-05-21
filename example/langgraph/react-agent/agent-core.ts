import {
  StateGraph,
  StateSchema,
  MessagesValue,
  START,
  END,
} from '@langchain/langgraph'
import type { GraphNode, ConditionalEdgeRouter } from '@langchain/langgraph'
import { ChatOpenAI } from '@langchain/openai'
import dotenv from 'dotenv'
import { isAIMessage } from '@langchain/core/messages'
import type { StructuredToolInterface } from '@langchain/core/tools'
import tools from './tools.js'
dotenv.config({ path: new URL('../../../.env.local', import.meta.url) })



// 状态：只需要一个消息列表
// 用户输入、模型回复、工具调用请求、工具执行结果——全部是消息
export const State = new StateSchema({
  messages: MessagesValue,
})

// 模型：绑定工具后，模型在推理时会自动考虑是否调用它们
export const model = new ChatOpenAI({
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  },
}).bindTools(tools)

// 节点 1：调用模型
// 把所有消息（含历史对话和工具结果）发给模型，拿回回复
export const callModel: GraphNode<typeof State> = async (state) => {
  const response = await model.invoke(state.messages)
  return { messages: [response] }
}

// 节点 2：执行工具
// 从模型回复中取出工具调用请求，执行后把结果放回消息列表
export const toolsByName = Object.fromEntries(tools.map((t: StructuredToolInterface) => [t.name, t]))

export const callTools: GraphNode<typeof State> = async (state) => {
  const lastMsg = state.messages.at(-1)!

  if (!isAIMessage(lastMsg)) {
    throw new Error('最后一条消息不是 AIMessage，无法执行工具调用')
  }

  const toolCalls = lastMsg.tool_calls ?? []

  // 多个工具调用并行执行
  const results = await Promise.all(
    toolCalls.map(async (tc) => {
      try {
        const result = await toolsByName[tc.name].invoke(tc.args)
        return { role: 'tool' as const, content: result, tool_call_id: tc.id }
      } catch (err) {
        // 工具失败时把错误信息返回给模型，让它自己决定怎么应对
        const errorMsg = err instanceof Error ? err.message : String(err)
        return {
          role: 'tool' as const,
          content: `工具执行失败: ${errorMsg}`,
          tool_call_id: tc.id,
        }
      }
    }),
  )

  return { messages: results }
}