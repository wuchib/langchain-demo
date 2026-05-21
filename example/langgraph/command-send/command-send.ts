import {
  StateGraph,
  StateSchema,
  ReducedValue,
  Command,
  Send,
  START,
  END,
} from '@langchain/langgraph'
import type { GraphNode } from '@langchain/langgraph'
import { z } from 'zod'

const appendStrings = (current: string[], update: string[]) => {
  return [...current, ...update]
}

const State = new StateSchema({
  topics: z.array(z.string()).default([]),
  summaries: new ReducedValue(
    z.array(z.string()).default([]),
    { reducer: appendStrings },
  ),
  status: z.string().default(''),
})

// dispatcher 既更新状态，又触发并行扇出
const dispatcher: GraphNode<typeof State> = (state) => {
  return new Command({
    update: { status: `正在处理 ${state.topics.length} 个主题` },
    goto: state.topics.map(
      (topic) => new Send('summarize', { topics: [topic] })
    ),
  })
}

const summarize: GraphNode<typeof State> = (state) => {
  const topic = state.topics[0]
  return {
    summaries: [`${topic} 分析完成`],
  }
}

const graph = new StateGraph(State)
  .addNode('dispatcher', dispatcher, { ends: ['summarize'] })
  .addNode('summarize', summarize)
  .addEdge(START, 'dispatcher')
  .addEdge('summarize', END)
  .compile()

const result = await graph.invoke({
  topics: ['性能优化', '错误处理', '状态管理'],
})

console.log(result.status)
// → 正在处理 3 个主题
console.log(result.summaries)
// → ['性能优化 分析完成', '错误处理 分析完成', '状态管理 分析完成']