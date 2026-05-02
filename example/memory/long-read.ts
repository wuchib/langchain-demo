import { createAgent } from 'langchain'
import { MemorySaver } from '@langchain/langgraph'

const checkpointer = new MemorySaver()

const agent = createAgent({
  model: 'openai:gpt-4.1-mini',
  tools: [],
  checkpointer,
})

async function loadUserProfile(userId: string) {
  // 这里用假数据演示。
  // 实际项目里可以从 D1 的 user_profiles / memories 表查询。
  return {
    name: '小林',
    occupation: '前端开发',
    preferences: ['回复简短一点', '不要太说教'],
    recentEvents: ['上周刚结束字节二面', '最近在补系统设计'],
  }
}

async function runAgent(input: string) {
  // 1. 先从数据库里读取这个用户的长期资料。
  const profile = await loadUserProfile('user-001')

  const result = await agent.invoke(
    {
      messages: [
        {
          role: 'system',
          content: `你是小林的 AI 伴侣。

已知信息：
- 职业：${profile.occupation}
- 回复偏好：${profile.preferences.join('、')}
- 近期事件：${profile.recentEvents.join('、')}

如果用户提到这些内容，要自然接住，不要生硬复述。`,
        },
        {
          // 2. 这一轮新消息还是普通的 user 消息。
          role: 'user',
          content: input,
        },
      ],
    },
    {
      configurable: {
        // 3. 同一个 thread_id 负责接住这段会话里的短期上下文。
        thread_id: 'companion-user-001',
      },
    },
  )

  // 4. 最后一条消息就是 Agent 这一轮生成的回复。
  return result.messages.at(-1)?.text ?? ''
}

await runAgent('我今天又在改上次那个需求。')
await runAgent('还是觉得很烦，像是一直在原地打转。')
