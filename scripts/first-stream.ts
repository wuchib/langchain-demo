import dotenv from 'dotenv'
import { ChatOpenAI } from '@langchain/openai'

dotenv.config({ path: new URL('../.env.local', import.meta.url) })

const model = new ChatOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  },
})

const stream = await model.stream([
  {
    role: 'system',
    content: '你是一名面向前端开发者的助手，回答要自然、简短。',
  },
  {
    role: 'user',
    content: '请用一句话说明当前是流式输出验证。',
  },
])

process.stdout.write('stream result:\n')

for await (const chunk of stream) {
  process.stdout.write(chunk.text)
}

process.stdout.write('\n')