/**
 * 第一，fanOut 不是返回一个节点名，而是返回一个 Send 数组。每个 Send 都指向同一个 summarize 节点，但传入的状态不同。LangGraph 会把它们并行执行。

第二，summaries 字段必须声明 reducer。因为三个并行节点都在往这个字段里写，如果没有 reducer，结果会互相覆盖，只留下最后一个。

第三，Send 的第二个参数是传给目标节点的状态。这里传的是 { topics: [topic] }，只包含一个 topic。目标节点 summarize 拿到的 state.topics 就只有一个元素。
 */
import {
  StateGraph,
  StateSchema,
  ReducedValue,
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
  // 多个并行节点都会写 summaries，所以必须用 reducer 追加
  summaries: new ReducedValue(
    z.array(z.string()).default([]),
    { reducer: appendStrings },
  ),
})

// 这个节点会被并行调用多次，每次拿到一个不同的 topic
const summarize: GraphNode<typeof State> = (state) => {
  const topic = state.topics[0]
  return {
    summaries: [`「${topic}」的摘要：这是一段关于 ${topic} 的分析...`],
  }
}

// 路由函数返回 Send 数组，触发并行扇出（fan-out）
// 这里的“扇出”是分布式系统里的常用说法，意思是把一份输入拆成多份子任务，同时分发给多个并行执行的分支
const fanOut = (state: typeof State.type) => {
  return state.topics.map(
    (topic) => new Send('summarize', { topics: [topic] })
  )
}

const graph = new StateGraph(State)
  .addNode('summarize', summarize)
  .addConditionalEdges(START, fanOut)
  .addEdge('summarize', END)
  .compile()

const result = await graph.invoke({
  topics: ['React', 'LangGraph', 'Zustand'],
})

console.log(result.summaries)
// [
//   '「React」的摘要：这是一段关于 React 的分析...',
//   '「LangGraph」的摘要：这是一段关于 LangGraph 的分析...',
//   '「Zustand」的摘要：这是一段关于 Zustand 的分析...',
// ]
