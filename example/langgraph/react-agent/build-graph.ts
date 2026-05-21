import { END, StateGraph, START, MemorySaver } from '@langchain/langgraph'
import { isAIMessage } from '@langchain/core/messages'
import { State, callModel, callTools } from './agent-core.js'


// 路由：模型回复里有工具调用就继续循环，没有就结束
const shouldContinue = (state: typeof State.State) => {
  const lastMsg = state.messages.at(-1)!
  if (isAIMessage(lastMsg) && lastMsg.tool_calls && lastMsg.tool_calls.length > 0) {
    return 'callTools'
  }
  return END
}

// 组装图
const graph = new StateGraph(State)
  .addNode('callModel', callModel)
  .addNode('callTools', callTools)
  .addEdge(START, 'callModel')                                     // 入口
  .addConditionalEdges('callModel', shouldContinue, ['callTools'])  // 条件分支
  .addEdge('callTools', 'callModel')                               // 循环回路
  .compile({
    checkpointer: new MemorySaver(),  // 支持多轮对话
  })




// single-turn

const config = { configurable: { thread_id: 'test-001' } }

// const result = await graph.invoke(
//   { messages: [{ role: 'user', content: '北京和上海今天天气怎么样？顺便算下 365 * 24' }] },
//   config,
// )

// for (const msg of result.messages) {
//   const type = msg.getType()
//   if (type === 'human') {
//     console.log(`[用户] ${msg.content}`)
//   } else if (type === 'ai' && isAIMessage(msg) && msg.tool_calls?.length) {
//     console.log(`[模型决策] 调用工具: ${msg.tool_calls.map(tc => `${tc.name}(${JSON.stringify(tc.args)})`).join(', ')}`)
//   } else if (type === 'tool') {
//     console.log(`[工具结果] ${msg.content}`)
//   } else {
//     console.log(`[模型回复] ${msg.content}`)
//   }
// }

// 多轮对话
// 第一轮
await graph.invoke(
  { messages: [{ role: 'user', content: '现在几点了？' }] },
  config,
)

// 第二轮：同一个 thread_id，上下文自动累积
const r2 = await graph.invoke(
  { messages: [{ role: 'user', content: '帮我算一下 365 * 24' }] },
  config,
)
console.log(r2.messages.at(-1)?.content)
// → 365 × 24 = 8760，一年有 8760 个小时。

// 第三轮：Agent 记得之前的对话
const r3 = await graph.invoke(
  { messages: [{ role: 'user', content: '前面我问了你什么？' }] },
  config,
)
console.log(r3.messages.at(-1)?.content)
// → 你先问了现在几点，然后问一年有多少小时。