import {
  StateGraph,
  StateSchema,
  MessagesValue,
  START,
  END,
} from '@langchain/langgraph'
import type { GraphNode } from '@langchain/langgraph'
import { MemorySaver } from '@langchain/langgraph'

const State = new StateSchema({
  messages: MessagesValue,
})

const echo: GraphNode<typeof State> = (state) => {
  const last = state.messages.at(-1)?.content?.toString() ?? ''
  return {
    messages: [{ role: 'assistant', content: `你说的是：${last}` }],
  }
}

const checkpointer = new MemorySaver()
const graph = new StateGraph(State)
  .addNode('echo', echo)
  .addEdge(START, 'echo')
  .addEdge('echo', END)
  .compile({ checkpointer })

const config = { configurable: { thread_id: 'undo-demo' } }

// 第一轮
await graph.invoke(
  { messages: [{ role: 'user', content: '第一条消息' }] },
  config,
)

// 第二轮
await graph.invoke(
  { messages: [{ role: 'user', content: '第二条消息' }] },
  config,
)

// 此时有 4 条消息：user1, ai1, user2, ai2

// 「撤回」第二轮：找到第一轮结束时的 checkpoint
let firstRoundConfig
for await (const snapshot of graph.getStateHistory(config)) {
  if (snapshot.values.messages?.length === 2) {
    firstRoundConfig = snapshot.config
    break
  }
}

// 如果没找到目标 checkpoint，说明历史数据有问题
if (!firstRoundConfig) {
  throw new Error('找不到第一轮结束的 checkpoint')
}

// 从第一轮的状态重新发一条不同的消息
const result = await graph.invoke(
  { messages: [{ role: 'user', content: '换一条消息' }] },
  firstRoundConfig,
)

console.log(result.messages.length)
// → 4（user1, ai1, user-new, ai-new）
// 原来的第二轮历史仍然存在；
// 这里只是从第一轮结束的状态出发，又分出了一条新的后续分支