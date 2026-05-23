import { InMemoryStore } from '@langchain/langgraph'

const store = new InMemoryStore()

const namespace = ['users', 'user_001', 'profile']

// put 的意思很直白：把一条 JSON 数据放进这个 namespace 下
await store.put(namespace, 'preferences', {
  tone: 'short',
  language: 'zh-CN',
  meetingPreference: 'weekend-morning',
})

const item = await store.get(namespace, 'preferences')

console.log(item?.value)
// → {
//     tone: 'short',
//     language: 'zh-CN',
//     meetingPreference: 'weekend-morning',
//   }