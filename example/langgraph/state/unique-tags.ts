/**
 * 去重合并
比如标签列表，不希望重复：
 */

import { StateGraph, StateSchema, ReducedValue, START } from '@langchain/langgraph'
import type { GraphNode } from '@langchain/langgraph'
import { z } from 'zod'

const mergeUniqueTags = (current: string[], update: string[]) => {
  return Array.from(new Set([...current, ...update]))
}

const State = new StateSchema({
  tags: new ReducedValue(
    z.array(z.string()).default([]),
    { reducer: mergeUniqueTags },
  ),
})

const fromText: GraphNode<typeof State> = () => {
  return { tags: ['AI', '机器学习'] }
}

const fromMeta: GraphNode<typeof State> = () => {
  return { tags: ['Python', 'AI'] }
}

const graph = new StateGraph(State)
  .addNode('fromText', fromText)
  .addNode('fromMeta', fromMeta)
  .addEdge(START, 'fromText')
  .addEdge(START, 'fromMeta')
  .compile()

const result = await graph.invoke({ tags: [] })
console.log(result.tags)
// ['AI', '机器学习', 'Python']