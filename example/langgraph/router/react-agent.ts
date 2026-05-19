import {
  StateGraph,
  StateSchema,
  MessagesValue,
  START,
  END,
} from '@langchain/langgraph'
import type { GraphNode, ConditionalEdgeRouter } from '@langchain/langgraph'
import { isAIMessage } from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import { tool } from '@langchain/core/tools'
import type { StructuredToolInterface } from '@langchain/core/tools'
import * as z from 'zod'

// 定义工具
const getWeather = tool(
  async ({ city }) => `${city}：多云，18-24°C`,
  {
    name: 'get_weather',
    description: '查询城市天气',
    schema: z.object({ city: z.string() }),
  },
)

const tools: StructuredToolInterface[] = [getWeather]
const toolMap = new Map(tools.map(toolDef => [toolDef.name, toolDef]))
const model = new ChatOpenAI({ model: 'gpt-4.1-mini' }).bindTools(tools)

const State = new StateSchema({
  messages: MessagesValue,
})

// 调用模型
const callModel: GraphNode<typeof State> = async (state) => {
  const response = await model.invoke(state.messages)
  return { messages: [response] }
}

// 执行工具
const callTools: GraphNode<typeof State> = async (state) => {
  const lastMsg = state.messages.at(-1)!
  if (!isAIMessage(lastMsg)) {
    throw new Error('最后一条消息不是 AIMessage，无法执行工具调用')
  }

  const toolCalls = lastMsg.tool_calls ?? []

  const toolResults = await Promise.all(
    toolCalls.map(async (tc) => {
      const selectedTool = toolMap.get(tc.name)

      if (!selectedTool) {
        throw new Error(`未知工具：${tc.name}`)
      }

      const result = await selectedTool.invoke(tc)
      return { role: 'tool' as const, content: result, tool_call_id: tc.id }
    }),
  )

  return { messages: toolResults }
}

// 路由：有工具调用就继续，没有就结束
const shouldContinue: ConditionalEdgeRouter<{
  InputSchema: typeof State
  Nodes: 'callTools'
}> = (state) => {
  const lastMsg = state.messages.at(-1)!

  if (isAIMessage(lastMsg) && lastMsg.tool_calls && lastMsg.tool_calls.length > 0) {
    return 'callTools'
  }

  return END
}
/**
 * 两个节点、三条边，就构成了一个完整的 ReAct Agent。模型可以连续调多个工具，每次调完都会回到模型，直到模型决定不再调用工具为止。

这和 LangChain 的 createAgent 做的事一样，但控制流是显式的。你可以在任意节点之间插入新的处理步骤（比如安全检查、日志记录），不需要改动模型的 prompt。
 */
// 构建图
const graph = new StateGraph(State)
  .addNode('callModel', callModel)
  .addNode('callTools', callTools)
  .addEdge(START, 'callModel')
  // 条件边只负责看最后一条模型消息里有没有 tool_calls，
  // 不负责执行工具，也不负责改消息。
  .addConditionalEdges('callModel', shouldContinue, ['callTools', END])
  .addEdge('callTools', 'callModel')  // 工具执行完，回到模型
  .compile()

const result = await graph.invoke({
  messages: [{ role: 'user', content: '北京和上海今天天气怎么样？' }],
})

for (const msg of result.messages) {
  console.log(`[${msg.getType()}]: ${msg.content?.toString().slice(0, 80)}`)
}
