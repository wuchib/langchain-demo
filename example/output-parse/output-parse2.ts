import { JsonOutputParser } from '@langchain/core/output_parsers'
import { ChatOpenAI } from '@langchain/openai'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config({ path: new URL('../../.env.local', import.meta.url) })

const emotionSchema = z.object({
  emotion: z.enum(['calm', 'anxious', 'sad', 'angry', 'happy']),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
})

const model = new ChatOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  },
})

const parser = new JsonOutputParser()

const prompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    [
      '判断用户情绪，并给出简短摘要。',
      '只返回符合格式要求的 JSON，不要补充解释。',
      'JSON 字段要求：',
      '- emotion: calm | anxious | sad | angry | happy',
      '- confidence: 0 到 1 之间的数字',
      '- summary: 简短中文摘要',
      '{formatInstructions}',
    ].join('\n'),
  ],
  ['user', '{input}'],
])

const chain = prompt.pipe(model).pipe(parser)

const result = await chain.invoke({
  input: '我中了一个亿，这辈子没见过这么多钱',
  formatInstructions: parser.getFormatInstructions(),
})

console.log(emotionSchema.parse(result))
