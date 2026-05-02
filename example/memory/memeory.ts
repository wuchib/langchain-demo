import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { ChatOpenAI } from '@langchain/openai'
import { RunnableWithMessageHistory } from '@langchain/core/runnables'
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history'
import dotenv from 'dotenv'

dotenv.config({ path: new URL('../../.env.local', import.meta.url) })
const model = new ChatOpenAI({
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  },
})

// 这里的 history 是给历史消息预留的位置（😀预留插槽） 。
const prompt = ChatPromptTemplate.fromMessages([
  ['system', '你是一个善于倾听的 AI 伴侣。'],
  new MessagesPlaceholder({ variableName: 'history' }), 
  ['user', '{input}'],
])

const chain = prompt.pipe(model)

// 这里用内存 Map 模拟会话存储。服务一重启，数据就会丢。
const store = new Map<string, InMemoryChatMessageHistory>()

function getMessageHistory(sessionId: string) {
  if (!store.has(sessionId)) {
    store.set(sessionId, new InMemoryChatMessageHistory())
  }

  return store.get(sessionId)!
}


// RunnableWithMessageHistory 会给原来的 chain 增加“自动读写历史”的能力。
// 这层把“读历史”和“写历史”都包进 Runnable 体系里。
const chainWithHistory = new RunnableWithMessageHistory({
  runnable: chain,
  getMessageHistory,
  inputMessagesKey: 'input',
  historyMessagesKey: 'history', // 这里与😀预留插槽的key对应
})

const a = await chainWithHistory.invoke(
  { input: '我爱吃苹果' },
  { configurable: { sessionId: 'user-1' } }
)

console.log(a);


// 从这里开始他就会知道你爱吃的是苹果了！
const b = await chainWithHistory.invoke(
  { input: '我爱吃什么？' },
  { configurable: { sessionId: 'user-1' } }
)
console.log(b);


