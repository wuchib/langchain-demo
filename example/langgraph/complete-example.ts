/**
 * 这一篇覆盖了 StateGraph 的基础骨架：

状态用 StateSchema 定义，MessagesValue 追加合并，普通 Zod 字段直接覆盖
节点是接收状态、返回部分更新的函数，用 GraphNode<typeof State> 约束类型
边用 addEdge 定义固定流转，用 addConditionalEdges 定义条件分支
START 和 END 标记图的入口和出口
compile() 把定义转化为可执行的图，invoke() 传入初始状态运行
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

// 1. 定义状态
const State = new StateSchema({
  messages: MessagesValue,
  intent: z.enum(['greeting', 'question', 'unknown']).default('unknown'),
  handled: z.boolean().default(false),
})

// 2. 定义节点

// 意图识别：从用户消息中判断意图
const classify: GraphNode<typeof State> = (state) => {
  const lastMsg = state.messages.at(-1)?.content?.toString() ?? ''

  let intent: 'greeting' | 'question' | 'unknown' = 'unknown'
  if (lastMsg.includes('你好') || lastMsg.includes('嗨')) {
    intent = 'greeting'
  } else if (lastMsg.includes('？') || lastMsg.includes('吗')) {
    intent = 'question'
  }

  return { intent }
}

// 处理问候
const handleGreeting: GraphNode<typeof State> = (_state) => {
  return {
    messages: [{ role: 'assistant', content: '你好呀！今天有什么我能帮你的？' }],
    handled: true,
  }
}

// 处理提问
const handleQuestion: GraphNode<typeof State> = (_state) => {
  return {
    messages: [{ role: 'assistant', content: '好问题！让我想想怎么回答你。' }],
    handled: true,
  }
}

// 兜底处理
const handleFallback: GraphNode<typeof State> = (_state) => {
  return {
    messages: [{ role: 'assistant', content: '我不太确定你想说什么，能再说清楚一点吗？' }],
    handled: true,
  }
}

// 3. 路由函数
type IntentRoute = 'handleGreeting' | 'handleQuestion' | 'handleFallback'

const intentRouter: ConditionalEdgeRouter<{
  InputSchema: typeof State
  Nodes: IntentRoute
}> = (state) => {
  switch (state.intent) {
    case 'greeting': return 'handleGreeting'
    case 'question': return 'handleQuestion'
    default: return 'handleFallback'
  }
}

// 4. 构建图
const graph = new StateGraph(State)
  .addNode('classify', classify)
  .addNode('handleGreeting', handleGreeting)
  .addNode('handleQuestion', handleQuestion)
  .addNode('handleFallback', handleFallback)
  .addEdge(START, 'classify')
  .addConditionalEdges('classify', intentRouter, [
    'handleGreeting', 'handleQuestion', 'handleFallback',
  ])
  .addEdge('handleGreeting', END)
  .addEdge('handleQuestion', END)
  .addEdge('handleFallback', END)
  .compile()

// 5. 运行
const result = await graph.invoke({
  messages: [{ role: 'user', content: '你好呀' }],
})

console.log('意图:', result.intent)
// → 意图: greeting

console.log('已处理:', result.handled)
// → 已处理: true

for (const msg of result.messages) {
  console.log(`[${msg.getType()}]: ${msg.content}`)
}
// → [human]: 你好呀
// → [ai]: 你好呀！今天有什么我能帮你的？
