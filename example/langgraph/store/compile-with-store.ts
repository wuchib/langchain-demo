import {
  StateGraph,
  StateSchema,
  MessagesValue,
  START,
  END,
  InMemoryStore,
} from '@langchain/langgraph'
import type { GraphNode } from '@langchain/langgraph'
import { z } from 'zod'

const State = new StateSchema({
  messages: MessagesValue,
})

const ContextSchema = z.object({
  userId: z.string(),
})
const namespace = ['users', 'user_001', 'profile']

const store = new InMemoryStore()

// put 的意思很直白：把一条 JSON 数据放进这个 namespace 下
await store.put(namespace, 'preferences', {
  tone: 'short',
  language: 'zh-CN',
  meetingPreference: 'weekend-morning',
})

const callModel: GraphNode<typeof State> = async (state, runtime) => {
  // 当前是谁，不适合塞进长期记忆里，
  // 更适合通过 runtime.context 在每次调用时带进来
  const userId = runtime.context?.userId
  const namespace = ['users', userId ?? 'anonymous', 'profile']

  // 节点里可以直接访问 runtime.store
  const memory = await runtime.store?.get(namespace, 'preferences')

  const preference = memory?.value?.tone ?? 'normal'

  return {
    messages: [{
      role: 'assistant',
      content: `已读取到用户偏好，当前语气要求：${preference}`,
    }],
  }
}

const graph = new StateGraph(State)
  .addNode('callModel', callModel)
  .addEdge(START, 'callModel')
  .addEdge('callModel', END)
  .compile({
    store,
    contextSchema: ContextSchema,
  })