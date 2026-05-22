import { StateGraph, StateSchema, ReducedValue, START, END } from '@langchain/langgraph'
import type { GraphNode } from '@langchain/langgraph'
import { z } from 'zod'

const ReviewState = new StateSchema({
  draft: z.string().default(''),
  issues: new ReducedValue(
    z.array(z.string()).default([]),
    { reducer: (current, update) => [...current, ...update] },
  ),
  passed: z.boolean().default(false),
})

const checkTone: GraphNode<typeof ReviewState> = (state) => {
  if (state.draft.includes('极限夸张')) {
    return {
      issues: ['语气过重，需要收一收'],
      passed: false,
    }
  }
  return { passed: true }
}

const checkFormat: GraphNode<typeof ReviewState> = (state) => {
  if (state.draft.length < 20) {
    return {
      issues: ['正文太短，发布页信息不够'],
      passed: false,
    }
  }
  return { passed: state.passed }
}

const reviewPipeline = new StateGraph(ReviewState)
  .addNode('checkTone', checkTone)
  .addNode('checkFormat', checkFormat)
  .addEdge(START, 'checkTone')
  .addEdge('checkTone', 'checkFormat')
  .addEdge('checkFormat', END)
  .compile()

const PublishState = new StateSchema({
  topic: z.string().default(''),
  draft: z.string().default(''),
  reviewIssues: new ReducedValue(
    z.array(z.string()).default([]),
    { reducer: (current, update) => [...current, ...update] },
  ),
  reviewPassed: z.boolean().default(false),
  published: z.boolean().default(false),
})

const generateDraft: GraphNode<typeof PublishState> = (state) => {
  return {
    draft: `【${state.topic}】LangGraph 可以把复杂流程拆成清楚的状态图。`,
  }
}

const runReviewPipeline: GraphNode<typeof PublishState> = async (state, config) => {
  // 父图把草稿交给审核子图，子图内部怎么拆，父图不需要知道
  // config 继续往下传，子图就还能接住同一次运行里的上下文和配置
  const reviewResult = await reviewPipeline.invoke(
    { draft: state.draft },
    config,
  )

  return {
    reviewIssues: reviewResult.issues,
    reviewPassed: reviewResult.passed && reviewResult.issues.length === 0,
  }
}

const publish: GraphNode<typeof PublishState> = (state) => {
  if (!state.reviewPassed) {
    return {
      published: false,
      draft: `[暂未发布] ${state.draft}`,
    }
  }

  return {
    published: true,
    draft: `[已发布] ${state.draft}`,
  }
}

const graph = new StateGraph(PublishState)
  .addNode('generateDraft', generateDraft)
  .addNode('runReviewPipeline', runReviewPipeline)
  .addNode('publish', publish)
  .addEdge(START, 'generateDraft')
  .addEdge('generateDraft', 'runReviewPipeline')
  .addEdge('runReviewPipeline', 'publish')
  .addEdge('publish', END)
  .compile()

const result = await graph.invoke({
  topic: '子图如何复用审核流程',
})

console.log(result.reviewIssues)
// → []

console.log(result.published)
// → true