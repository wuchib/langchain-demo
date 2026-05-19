import { StateGraph, StateSchema, ReducedValue, START } from '@langchain/langgraph'
import type { GraphNode } from '@langchain/langgraph'
import { z } from 'zod'

const appendResults = (current: string[], update: string[]) => {
  return [...current, ...update]
}

const State = new StateSchema({
  // ReducedValue 用来给这个字段显式声明 reducer。
  // 这里的字段语义是“追加到已有结果后面”。
  results: new ReducedValue(
    z.array(z.string()).default([]),
    { reducer: appendResults },
  ),
})

const searchDocs: GraphNode<typeof State> = () => {
  return {
    results: ['官方文档'],
  }
}

const searchCommunity: GraphNode<typeof State> = () => {
  return {
    results: ['社区文章'],
  }
}

const graph = new StateGraph(State)
  .addNode('searchDocs', searchDocs)
  .addNode('searchCommunity', searchCommunity)
  // 两个节点都从 START 出发，表示它们会在同一步里各自产生一份更新。
  .addEdge(START, 'searchDocs')
  .addEdge(START, 'searchCommunity')
  .compile()

const result = await graph.invoke({ results: [] })
console.log(result.results)
// ['官方文档', '社区文章']