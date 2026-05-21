const config = { configurable: { thread_id: 'chat-001' } }

// 找到第一轮对话结束时的 checkpoint
// getStateHistory 按时间倒序返回，最新的在前面
let targetConfig
for await (const snapshot of graph.getStateHistory(config)) {
  if (snapshot.values.messages?.length === 2) {
    // 2 条消息 = 第一轮的 user + ai
    targetConfig = snapshot.config
    break
  }
}

if (!targetConfig) {
  throw new Error('找不到目标 checkpoint')
}

// 从那个时间点重新开始，走一条不同的路
const result = await graph.invoke(
  { messages: [{ role: 'user', content: '换个话题，聊聊天气吧' }] },
  targetConfig,
)

/**
 * 这里要注意一个细节：snapshot.config 里已经带着这次快照对应的运行配置，其中就包含了定位历史状态所需的信息。把它再传回 graph.invoke(...)，图就会从那个历史点继续往下走。
 */

