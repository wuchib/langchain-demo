/**
 * 路由函数只做判断，不做计算。 把复杂逻辑放在节点里，路由函数只读状态字段
条件边负责路由，不负责改状态。 需要改状态时，让节点先写入状态，再由条件边读取
每个循环都必须有终止条件。 业务条件（正常出口）+ 保底条件（安全出口）
状态字段是路由的唯一依据。 不要在路由函数里调 API 或做随机决策
 */

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
  report: z.string().default(''),
  quality: z.enum(['unchecked', 'pass', 'fail']).default('unchecked'),
  reviewFeedback: z.string().default(''),
  reviewCount: z.number().default(0),
})

// 1. 收集信息（简化版，实际场景会调 LLM + 工具）
const gather: GraphNode<typeof State> = (state) => {
  const question = state.messages.at(-1)?.content?.toString() ?? ''
  return {
    messages: [{ role: 'assistant', content: `已收集「${question}」的相关信息。` }],
  }
}

// 2. 生成报告
const analyze: GraphNode<typeof State> = (state) => {
  if (state.reviewCount === 0) {
    return { report: '初步分析：数据呈上升趋势。' }
  }
  // 根据反馈改进
  return {
    report: `深度分析（第 ${state.reviewCount + 1} 版）：数据呈上升趋势，主要驱动因素是用户增长（+15%）和客单价提升（+8%）。环比增速放缓，需关注获客成本变化。`,
  }
}

// 3. 质量检查
const review: GraphNode<typeof State> = (state) => {
  const count = state.reviewCount + 1

  // 报告需要包含具体数据
  if (state.report.includes('%') && state.report.length > 50) {
    return {
      quality: 'pass' as const,
      reviewFeedback: '',
      reviewCount: count,
    }
  }

  return {
    quality: 'fail' as const,
    reviewFeedback: '报告缺少具体数据支撑，请补充百分比、绝对值等量化指标',
    reviewCount: count,
  }
}

// 4. 输出最终结果
const output: GraphNode<typeof State> = (state) => {
  return {
    messages: [{
      role: 'assistant',
      content: `分析完成（经过 ${state.reviewCount} 轮审核）：\n\n${state.report}`,
    }],
  }
}

// 路由：审核后决定是重新分析还是输出
const reviewRouter: ConditionalEdgeRouter<typeof State, 'analyze' | 'output'> = (state) => {
  if (state.quality === 'pass') return 'output'
  if (state.reviewCount >= 3) return 'output'  // 保底
  return 'analyze'                              // 重新分析
}

// 构建图
const graph = new StateGraph(State)
  .addNode('gather', gather)
  .addNode('analyze', analyze)
  .addNode('review', review)
  .addNode('output', output)
  .addEdge(START, 'gather')
  .addEdge('gather', 'analyze')
  .addEdge('analyze', 'review')
  .addConditionalEdges('review', reviewRouter, ['analyze', 'output'])
  .addEdge('output', END)
  .compile()

const result = await graph.invoke({
  messages: [{ role: 'user', content: '分析上季度的营收趋势' }],
})

console.log(result.messages.at(-1)?.content)
// → 分析完成（经过 2 轮审核）：
// → 深度分析（第 2 版）：数据呈上升趋势，主要驱动因素是...