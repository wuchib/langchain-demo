import dotenv from 'dotenv'
import { ChatOpenAI } from '@langchain/openai'

dotenv.config({ path: new URL('../.env.local', import.meta.url) })

const apiKey = process.env.DEEPSEEK_API_KEY
const modelName = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat'
const baseURL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1'

if (!apiKey) {
  console.error('Missing DEEPSEEK_API_KEY in .env.local')
  process.exit(1)
}

const model = new ChatOpenAI({
  apiKey,
  model: modelName,
  configuration: {
    baseURL,
  },
})

try {
  const response = await model.invoke([
    {
      role: 'system',
      content: '你是一名面向前端开发者的助手，回答要清楚、简短。',
    },
    {
      role: 'user',
      content: '请用两句话确认 LangChain 与 DeepSeek 的连接已经正常。',
    },
  ])

  console.log('invoke result:')
  console.log(response.text)
} catch (error) {
  const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined
  const message =
    typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error)

  if (status === 402) {
    console.error('DeepSeek API request failed: insufficient balance.')
    console.error(`Base URL: ${baseURL}`)
    console.error(`Model: ${modelName}`)
    console.error('Please top up the provider account or switch to another API key, then retry.')
    process.exit(1)
  }

  console.error('DeepSeek API request failed.')
  console.error(message)
  process.exit(1)
}
