import {
  StateGraph,
  StateSchema,
  START,
  END,
  Command,
} from '@langchain/langgraph'
import type { GraphNode } from '@langchain/langgraph'
import { z } from 'zod'

const State = new StateSchema({
  draft: z.string().default(''),
  retryCount: z.number().default(0),
  feedback: z.string().default(''),
})

// generate 不需要改，它只负责生成草稿
const generate: GraphNode<typeof State> = (state) => {
  if (state.retryCount === 0) {
    return { draft: 'LangGraph 是一个框架。', retryCount: 1 }
  }
  return {
    draft: `LangGraph 是一个基于图的 AI 工作流编排框架，支持状态管理、条件路由和持久化。（第 ${state.retryCount + 1} 版）`,
    retryCount: state.retryCount + 1,
  }
}

// validate 现在直接决定下一步去哪，不需要单独的路由函数了
const validate: GraphNode<typeof State> = (state) => {
  if (state.draft.length >= 30) {
    return new Command({
      update: { feedback: '' },
      goto: 'output',
    })
  }

  if (state.retryCount >= 3) {
    return new Command({
      update: { feedback: '已达最大重试次数' },
      goto: 'output',
    })
  }

  return new Command({
    update: { feedback: `草稿太短（${state.draft.length} 字），至少需要 30 字` },
    goto: 'generate',
  })
}

const output: GraphNode<typeof State> = (state) => {
  return { draft: `最终结果：${state.draft}` }
}

const graph = new StateGraph(State)
  .addNode('generate', generate)
  // ends 声明 validate 可能跳到的所有目标
  .addNode('validate', validate, { ends: ['generate', 'output'] })
  .addNode('output', output)
  .addEdge(START, 'generate')
  .addEdge('generate', 'validate')
  .addEdge('output', END)
  .compile()

const result = await graph.invoke({})
console.log(result.draft)
// → 最终结果：LangGraph 是一个基于图的 AI 工作流编排框架...



/**
 * 和retry-pattern.ts对比，省掉了：

isValid 状态字段——不需要了，validate 内部直接判断完就跳转
checkResult 路由函数——不需要了，路由逻辑在 validate 节点里
addConditionalEdges——不需要了，换成 addNode 的 ends
注意 generate → validate 之间还是用的普通边。因为 generate 执行完一定走 validate，没有条件分支。只有 validate 的下一步不确定，所以只有它用了 Command。

什么时候用 Command，什么时候用条件边
 */