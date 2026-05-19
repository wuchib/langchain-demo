import {
  StateGraph,
  StateSchema,
  MessagesValue,
  START,
  END,
} from '@langchain/langgraph'
import type { GraphNode } from '@langchain/langgraph'
import { z } from 'zod'

// 1. 定义状态
const MyState = new StateSchema({
  messages: MessagesValue,
  currentStep: z.string().default('init'),
})

// 2. 定义节点
// 每个节点是一个函数，接收当前状态，返回状态的部分更新
const greet: GraphNode<typeof MyState> = (state) => {
  const userName = state.messages.at(-1)?.content ?? '朋友'
  return {
    messages: [{ role: 'assistant', content: `你好，${userName}！` }],
    currentStep: 'greeted',
  }
}

const farewell: GraphNode<typeof MyState> = (state) => {
  return {
    messages: [{ role: 'assistant', content: '再见，有问题随时来找我。' }],
    currentStep: 'done',
  }
}

// 3. 构建图
const graph = new StateGraph(MyState)
  // 添加节点：名称 + 处理函数
  .addNode('greet', greet)
  .addNode('farewell', farewell)
  // 添加边：定义流转关系
  .addEdge(START, 'greet')       // 入口 → greet
  .addEdge('greet', 'farewell')  // greet → farewell
  .addEdge('farewell', END)      // farewell → 结束
  // 编译：把图定义转化为可运行的实例
  .compile()

// 4. 运行
const result = await graph.invoke({
  messages: [{ role: 'user', content: '小明' }],
})

console.log(result.currentStep)
// → 'done'

for (const msg of result.messages) {
  console.log(`[${msg.getType()}]: ${msg.content}`)
}
// → [human]: 小明
// → [ai]: 你好，小明！
// → [ai]: 再见，有问题随时来找我。