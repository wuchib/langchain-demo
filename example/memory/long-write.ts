import { ChatOpenAI } from '@langchain/openai'
import { JsonOutputParser } from '@langchain/core/output_parsers'

type D1Database = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>
    }
  }
}

declare const env: { DB: D1Database }

const model = new ChatOpenAI({
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  },
})

const parser = new JsonOutputParser()

async function extractLongTermMemory(conversationText: string) {
  // 这里提取的是“值得跨会话保留的信息”，
  // 不是把整段原始聊天再存一遍。
  const prompt = `请从下面这段对话里提取长期记忆。

返回 JSON，包含：
- facts: 用户事实
- events: 重要事件
- preferences: 用户偏好
- emotionSnapshot: 情绪概括

对话内容：
${conversationText}`

  const response = await model.invoke(prompt)
  return parser.invoke(response)
}

async function saveLongTermMemory(userId: string, conversationId: string, memory: any) {
  // 这里把提取出来的长期信息拆成一条条记录写进 memories 表。
  // 实际项目里可以再补 type、score、source 等字段。
  const rows = [
    ...(memory.facts ?? []).map((content: string) => ({
      type: 'fact',
      content,
    })),
    ...(memory.events ?? []).map((content: string) => ({
      type: 'event',
      content,
    })),
    ...(memory.preferences ?? []).map((content: string) => ({
      type: 'preference',
      content,
    })),
    ...(memory.emotionSnapshot ? [{
      type: 'emotion_snapshot',
      content: memory.emotionSnapshot,
    }] : []),
  ]

  for (const row of rows) {
    await env.DB.prepare(
      `INSERT INTO memories (user_id, conversation_id, type, content)
       VALUES (?, ?, ?, ?)`,
    )
      .bind(userId, conversationId, row.type, row.content)
      .run()
  }
}

async function persistConversationMemory() {
  const extracted = await extractLongTermMemory(`
用户：我今天又在准备字节的二面，还是有点焦虑。
助手：你更担心面试本身，还是等结果这段时间？
用户：主要是等结果，而且我还是不喜欢别人一直给我灌鸡汤。
  `)

  // 先提取，再写库。
  await saveLongTermMemory('user-001', 'conversation-20260330', extracted)
}
