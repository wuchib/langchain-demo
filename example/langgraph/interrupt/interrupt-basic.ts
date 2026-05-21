
/**
 * 第一，interrupt 暂停后，图不会返回最终结果。 第一次 invoke 拿到的是暂停时的状态，不是图跑完后的最终结果。你可以通过 getState 查看暂停信息。

第二，恢复时传入的是 Command({ resume })，不是普通的输入。 Command 的 resume 值会变成 interrupt() 的返回值。节点从暂停的位置继续往下执行。

第三，恢复时还是沿用同一个 config（同一个 thread_id）。 因为图的状态是按 thread_id 保存的，恢复时得把这一条会话重新接上。
 */


/**
 * 把整个流程拆开看：

graph.invoke(input, config) 开始执行
图走到 askHuman 节点
节点代码执行到 interrupt(...) 这一行
interrupt 内部抛出一个特殊的 GraphInterrupt 错误
LangGraph 捕获这个错误，通过 checkpointer 保存当前状态
invoke 返回，图处于暂停状态
调用方通过 getState 看到 next: ['askHuman'] 和中断信息
调用方用 Command({ resume }) 再次调用 invoke
LangGraph 加载保存的状态，从 askHuman 节点重新执行
这次 interrupt() 发现有 resume 值，不再抛错，而是直接返回这个值
节点继续执行后续代码
图正常走完

关键理解：恢复时节点会从头重新执行一次。 interrupt() 之前的代码会再跑一遍，但 interrupt() 这次不会暂停，而是直接返回 resume 值。所以 interrupt() 之前的代码应该是幂等的（多次执行结果一样）。
 */
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
  question: z.string().default(''),
  answer: z.string().default(''),
})

const askHuman: GraphNode<typeof State> = (state) => {
  // 图执行到这里就会暂停
  // '请回答问题' 是带给调用方的提示信息
  const humanAnswer = interrupt(`请回答问题：${state.question}`)

  // 这一行在暂停时不会执行
  // 只有恢复后才会继续往下走
  return { answer: humanAnswer }
}

const graph = new StateGraph(State)
  .addNode('askHuman', askHuman)
  .addEdge(START, 'askHuman')
  .addEdge('askHuman', END)
  .compile({ checkpointer: new MemorySaver() })

// ① 第一次调用：图会在 interrupt() 处暂停
const config = { configurable: { thread_id: 'demo-001' } }
const result1 = await graph.invoke(
  { question: '你最喜欢的编程语言是什么？' },
  config,
)

// result1 不是最终结果，而是暂停时的状态
// 暂停的信息可以通过 getState 查看
const snapshot = await graph.getState(config)
console.log(snapshot.next)
// → ['askHuman']  ← 图暂停在 askHuman 节点

console.log(snapshot.tasks[0]?.interrupts)
// → [{ value: '请回答问题：你最喜欢的编程语言是什么？' }]

// ② 恢复执行：用 Command 传入回复
const result2 = await graph.invoke(
  new Command({ resume: 'TypeScript' }),
  config,
)

console.log(result2.answer)
// → TypeScript