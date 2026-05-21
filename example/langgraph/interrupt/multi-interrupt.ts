import {
  StateGraph,
  StateSchema,
  START,
  END,
  Command,
  interrupt,
  MemorySaver,
} from '@langchain/langgraph'
import type { GraphNode } from '@langchain/langgraph'
import { z } from 'zod'

const State = new StateSchema({
  name: z.string().default(''),
  age: z.string().default(''),
  greeting: z.string().default(''),
})

const collectInfo: GraphNode<typeof State> = () => {
  // 第一个 interrupt：收集姓名
  const name = interrupt('请输入你的姓名')

  // 第二个 interrupt：收集年龄
  // 第一次恢复后，执行到这里会再次暂停
  const age = interrupt('请输入你的年龄')

  return {
    name,
    age,
    greeting: `你好，${name}！你今年 ${age} 岁。`,
  }
}

const graph = new StateGraph(State)
  .addNode('collectInfo', collectInfo)
  .addEdge(START, 'collectInfo')
  .addEdge('collectInfo', END)
  .compile({ checkpointer: new MemorySaver() })

const config = { configurable: { thread_id: 'multi-001' } }

// ① 第一次调用：暂停在第一个 interrupt
await graph.invoke({}, config)
let snapshot = await graph.getState(config)
console.log(snapshot.tasks[0]?.interrupts[0]?.value)
// → '请输入你的姓名'

// ② 恢复第一个：传入姓名，然后暂停在第二个 interrupt
await graph.invoke(new Command({ resume: '小明' }), config)
snapshot = await graph.getState(config)
console.log(snapshot.tasks[0]?.interrupts[0]?.value)
// → '请输入你的年龄'

// ③ 恢复第二个：传入年龄，图跑完
const result = await graph.invoke(new Command({ resume: '25' }), config)
console.log(result.greeting)
// → 你好，小明！你今年 25 岁。