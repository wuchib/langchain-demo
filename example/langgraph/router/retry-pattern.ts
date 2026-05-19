import {
  StateGraph,
  StateSchema,
  MessagesValue,
  START,
  END,
} from '@langchain/langgraph'
import type { GraphNode, ConditionalEdgeRouter } from '@langchain/langgraph'
import { z } from 'zod'

const State = new StateSchema({
  messages: MessagesValue,
  draft: z.string().default(''),
  isValid: z.boolean().default(false),
  retryCount: z.number().default(0),
  feedback: z.string().default(''),
})

// 生成节点：根据反馈改进草稿
const generate: GraphNode<typeof State> = (state) => {
  if (state.retryCount === 0) {
    return {
      draft: 'LangGraph 是一个框架。',
      retryCount: 1,
    }
  }
  // 后续根据反馈改进（实际场景调 LLM）
  return {
    draft: `LangGraph 是一个基于图的 AI 工作流编排框架，支持状态管理、条件路由和持久化。（第 ${state.retryCount + 1} 版）`,
    retryCount: state.retryCount + 1,
  }
}

// 验证节点：检查草稿质量
const validate: GraphNode<typeof State> = (state) => {
  if (state.draft.length >= 30) {
    return { isValid: true, feedback: '' }
  }
  return {
    isValid: false,
    feedback: `草稿太短（${state.draft.length} 字），至少 30 字`,
  }
}

// 路由：通过就结束，否则重试
const checkResult: ConditionalEdgeRouter<{
  InputSchema: typeof State
  Nodes: 'generate'
}> = (state) => {
  if (state.isValid) return END
  if (state.retryCount >= 3) return END   // 防止无限循环
  return 'generate'
}

// 构建图
const graph = new StateGraph(State)
  .addNode('generate', generate)
  .addNode('validate', validate)
  .addEdge(START, 'generate')
  .addEdge('generate', 'validate')
  // 第三个参数声明：这条条件边可能会回到 generate，也可能结束。
  .addConditionalEdges('validate', checkResult, ['generate', END])
  .compile()

const result = await graph.invoke({
  messages: [{ role: 'user', content: '写一段关于 LangGraph 的介绍' }],
})

console.log(`经过 ${result.retryCount} 次尝试`)
console.log(`通过验证: ${result.isValid}`)
console.log(`最终草稿: ${result.draft}`)
// → 经过 2 次尝试
// → 通过验证: true
// → 最终草稿: LangGraph 是一个基于图的 AI 工作流编排框架...
