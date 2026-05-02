import { createAgent } from 'langchain'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { JsonOutputParser } from '@langchain/core/output_parsers'
import { RunnableLambda, RunnablePassthrough } from '@langchain/core/runnables'
import { ChatOpenAI } from '@langchain/openai'
import dotenv from 'dotenv'

dotenv.config({ path: new URL('../../.env.local', import.meta.url) })


type ChainInput = {
  input: string
}

type EmotionResult = {
  emotion: string
  confidence: number
}

const primaryModel = new ChatOpenAI({
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  },
})

const backupModel = new ChatOpenAI({
  model: process.env.DEEPSEEK_MODEL_FALLBACK ?? 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  },
})

// 模型层容错：主模型先 retry，再切到备用模型。
const safeModel = primaryModel
  .withRetry({ stopAfterAttempt: 2 })
  .withFallbacks([
    backupModel.withRetry({ stopAfterAttempt: 2 }),
  ])

// 前置分析链：负责给 Agent 补一个 emotion 字段。
const emotionChain = ChatPromptTemplate.fromMessages([
  ['system', '分析用户情绪，只返回 JSON：{"emotion":"", "confidence":0}'],
  ['user', '{input}'],
])
  .pipe(safeModel)
  .pipe(new JsonOutputParser<EmotionResult>())

// 如果情绪分析失败，就退到一个最小默认值，别让整条链直接中断。
const safeEmotionChain = emotionChain.withFallbacks([
  RunnableLambda.from<ChainInput, EmotionResult>(() => ({
    emotion: 'unknown',
    confidence: 0,
  })),
])

// 这条前置链负责保留原始输入，并补 emotion。
const preProcess = RunnablePassthrough.assign({
  emotion: safeEmotionChain,
})

const agent = createAgent({
  model: safeModel,
  tools: [],
  systemPrompt: [
    '你是一个前端陪伴助手。',
    '如果 emotion 显示用户情绪低落，先共情，再给一个小建议。',
    '如果 emotion 不明确，就正常交流，不要编造分析结果。',
  ].join('\n'),
})

// 整条链最后的兜底：如果 Agent 回复这一步都失败了，至少返回固定文案。
const finalFallback = RunnableLambda.from(
  () => '我现在状态不太稳定，但我还在这里。你刚刚说的内容我已经收到了，等我恢复后会继续陪你。'
)

async function runAgent(input: string) {
  // 第 1 层：先跑前置链，尽量把分析结果补齐。
  const preProcessed = await preProcess.invoke({ input })

  // 第 2 层：再把整理后的消息交给 Agent。
  const replyChain = RunnableLambda.from(async () => {
    const result = await agent.invoke({
      messages: [
        {
          role: 'user',
          content: [
            `input=${preProcessed.input}`,
            `emotion=${JSON.stringify(preProcessed.emotion)}`,
          ].join('\n'),
        },
      ],
    })

    return result.messages.at(-1)?.text ?? ''
  })

  // 第 3 层：如果回复链也失败，就落到最后一层固定文案。
  return replyChain.withFallbacks([finalFallback]).invoke({})
}

const reply = await runAgent('今天加班到很晚，有点撑不住了。')

console.log(reply)
