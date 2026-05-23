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

const store = new InMemoryStore()

await store.put(['users', 'user_001', 'profile'], 'preferences', {
  tone: 'short',
  language: 'zh-CN',
})

const respondWithMemory: GraphNode<typeof State> = async (state, runtime) => {
  const userId = runtime.context?.userId
  const namespace = ['users', userId ?? 'anonymous', 'profile']
  // 这里读的是用户长期偏好，不是当前线程里的临时状态
  const item = await runtime.store?.get(namespace, 'preferences')

  const tone = item?.value?.tone ?? 'normal'
  const language = item?.value?.language ?? 'zh-CN'
  const question = state.messages.at(-1)?.text ?? ''

  return {
    messages: [{
      role: 'assistant',
      content: `我会用 ${language} 回复，并保持 ${tone} 风格。你刚刚的问题是：${question}`,
    }],
  }
}

const graph = new StateGraph(State)
  .addNode('respondWithMemory', respondWithMemory)
  .addEdge(START, 'respondWithMemory')
  .addEdge('respondWithMemory', END)
  .compile({
    store,
    contextSchema: ContextSchema,
  })

const result = await graph.invoke(
  {
    messages: [{ role: 'user', content: '以后回复我尽量简短一点。' }],
  },
  {
    context: { userId: 'user_001' },
  },
)

console.log(result.messages.at(-1)?.text)