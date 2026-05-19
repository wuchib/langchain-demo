import { ChatOpenAI } from '@langchain/openai'
import { tool } from '@langchain/core/tools'
import { StateGraph, StateSchema, MessagesValue, START, END } from '@langchain/langgraph'
import type { GraphNode } from '@langchain/langgraph'
import { z } from 'zod'

// LangChain 的组件：模型和工具
const model = new ChatOpenAI({ model: 'gpt-4.1-mini' })
const getWeather = tool(
  async ({ city }) => `${city}：明天小雨，17-22 度`,
  {
    name: 'get_weather',
    description: '查询天气',
    schema: z.object({ city: z.string() }),
  },
)

const modelWithTools = model.bindTools([getWeather])

const State = new StateSchema({
  messages: MessagesValue,
})

// LangGraph 的节点：内部使用 LangChain 组件
const callModel: GraphNode<typeof State> = async (state) => {
  const response = await modelWithTools.invoke(state.messages)
  return { messages: [response] }
}

// LangGraph 负责编排
const graph = new StateGraph(State)
  .addNode('callModel', callModel)
  .addEdge(START, 'callModel')
  .addEdge('callModel', END)
  .compile()