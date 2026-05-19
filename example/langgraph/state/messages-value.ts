/**
 * 消息字段是最特殊的一类。
因为对话图里最常见的状态，不是一个普通字符串，而是一串消息。

这时候你真正想要的，不是：

新消息把旧消息覆盖掉
而是：

用户消息、模型消息、工具消息都按顺序累积起来
 */

import { StateGraph, StateSchema, MessagesValue, START, END } from '@langchain/langgraph'
import type { GraphNode } from '@langchain/langgraph'

const State = new StateSchema({
  messages: MessagesValue,
})

const callModel: GraphNode<typeof State> = async () => {
  return {
    messages: [
      { role: 'assistant', content: '你好，有什么想聊的？' },
    ],
  }
}

const graph = new StateGraph(State)
  .addNode('callModel', callModel)
  .addEdge(START, 'callModel')
  .addEdge('callModel', END)
  .compile()

const result = await graph.invoke({
  messages: [{ role: 'user', content: '你好' }],
})

console.log(result.messages.length)
// 2