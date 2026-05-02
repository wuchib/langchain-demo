import { ChatPromptTemplate } from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'
import {
  RunnableBranch,
  RunnablePassthrough,
} from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import dotenv from 'dotenv'

dotenv.config({ path: new URL('../../.env.local', import.meta.url) })

const model = new ChatOpenAI({
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  },
})

const classifyChain = ChatPromptTemplate.fromMessages([
  [
    'system',
    [
      '判断用户消息意图，只输出以下三个类别之一：',
      '- tech',
      '- emotional',
      '- casual',
    ].join('\n'),
  ],
  ['user', '{input}'],
])
  .pipe(model)
  .pipe(new StringOutputParser())

const techChain = ChatPromptTemplate.fromMessages([
  [
    'system',
    [
      '你是一个前端技术助手。',
      '用简洁、可执行的方式回答用户的技术问题。',
      '优先给出判断、原因和下一步动作。',
    ].join('\n'),
  ],
  ['user', '{input}'],
])
  .pipe(model)
  .pipe(new StringOutputParser())

const emotionalChain = ChatPromptTemplate.fromMessages([
  [
    'system',
    [
      '你是一个温和的情绪陪伴助手。',
      '先接住用户的感受，再给一个很小、马上能做的建议。',
      '不要说教，也不要把问题放大。',
    ].join('\n'),
  ],
  ['user', '{input}'],
])
  .pipe(model)
  .pipe(new StringOutputParser())

const casualChain = ChatPromptTemplate.fromMessages([
  [
    'system',
    [
      '你是一个轻松自然的聊天助手。',
      '用口语化、简短的方式回应用户。',
      '如果合适，可以顺手接一句开放式问题。',
    ].join('\n'),
  ],
  ['user', '{input}'],
])
  .pipe(model)
  .pipe(new StringOutputParser())

const routeByIntent = RunnableBranch.from([
  [
    ({ intent }: { intent: string }) => intent.trim() === 'tech',
    techChain,
  ],
  [
    ({ intent }: { intent: string }) => intent.trim() === 'emotional',
    emotionalChain,
  ],
  casualChain,
])

const chain = RunnablePassthrough
  .assign({ intent: classifyChain })
  .pipe(routeByIntent)

const result = await chain.invoke({
  input: 'React 组件频繁重新渲染，应该怎么排查？',
})

console.log(result)
