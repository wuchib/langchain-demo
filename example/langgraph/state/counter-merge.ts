/**
 * 计数器也很常见。
比如：

走了多少步
调了多少次工具
用了多少 token
这种字段如果直接覆盖，往往就没意义了。
 */

import { StateGraph, StateSchema, ReducedValue, START } from '@langchain/langgraph'
import type { GraphNode } from '@langchain/langgraph'
import { z } from 'zod'

const addNumber = (current: number, update: number) => {
  return current + update
}

const State = new StateSchema({
  // 计数器字段的语义不是覆盖，而是累加。
  stepCount: new ReducedValue(
    z.number().default(0),
    { reducer: addNumber },
  ),
})

const stepA: GraphNode<typeof State> = () => {
  return { stepCount: 1 }
}

const stepB: GraphNode<typeof State> = () => {
  return { stepCount: 1 }
}

const graph = new StateGraph(State)
  .addNode('stepA', stepA)
  .addNode('stepB', stepB)
  // 这里同样是两路并行写入 stepCount，所以 reducer 才有意义。
  .addEdge(START, 'stepA')
  .addEdge(START, 'stepB')
  .compile()

const result = await graph.invoke({ stepCount: 0 })
console.log(result.stepCount)
// 2