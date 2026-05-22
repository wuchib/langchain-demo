import { StateGraph, StateSchema, ReducedValue, START, END } from '@langchain/langgraph'
import type { GraphNode } from '@langchain/langgraph'
import { z } from 'zod'

const ParentState = new StateSchema({
  topic: z.string().default(''),
  draft: z.string().default(''),
  reviewIssues: new ReducedValue(
    z.array(z.string()).default([]),
    { reducer: (current, update) => [...current, ...update] },
  ),
  reviewPassed: z.boolean().default(false),
})

const ReviewState = new StateSchema({
  draft: z.string().default(''),
  issues: new ReducedValue(
    z.array(z.string()).default([]),
    { reducer: (current, update) => [...current, ...update] },
  ),
  passed: z.boolean().default(false),
})

const checkLength: GraphNode<typeof ReviewState> = (state) => {
  if (state.draft.length >= 20) {
    return { passed: true }
  }
  return {
    issues: ['草稿太短，还不适合进入发布流程'],
    passed: false,
  }
}

const reviewGraph = new StateGraph(ReviewState)
  .addNode('checkLength', checkLength)
  .addEdge(START, 'checkLength')
  .addEdge('checkLength', END)
  .compile()

const runReviewSubgraph: GraphNode<typeof ParentState> = async (state, config) => {
  // 先把父图里真正需要的字段传给子图
  // 这里把 config 一起往下传，是为了把同一次图运行里的配置继续带给子图
  const reviewResult = await reviewGraph.invoke(
    { draft: state.draft },
    config,
  )

  // 再把子图的结果整理回父图自己的字段
  return {
    reviewIssues: reviewResult.issues,
    reviewPassed: reviewResult.passed,
  }
}