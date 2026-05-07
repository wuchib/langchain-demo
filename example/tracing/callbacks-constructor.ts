import { ChatOpenAI } from '@langchain/openai'
import { TraceCallbackHandler } from './trace-handler'
import dotenv from 'dotenv'
dotenv.config({ path: new URL('../../.env.local', import.meta.url) })

const handler = new TraceCallbackHandler()

const model = new ChatOpenAI({
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  },
  // handler 会收到这个 model 实例以及它内部所有子组件的事件
  callbacks: [handler],
})