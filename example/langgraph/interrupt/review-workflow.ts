import {
  StateGraph,
  StateSchema,
  START,
  END,
  Command,
  interrupt,
  MemorySaver,
} from '@langchain/langgraph'
import type { GraphNode } from '@langchain/langgraph'
import { z } from 'zod'

const State = new StateSchema({
  topic: z.string().default(''),
  draft: z.string().default(''),
  feedback: z.string().default(''),
  status: z.string().default('pending'),
  version: z.number().default(0),
})

// 1. 生成节点：根据主题（和可能的反馈）生成文案
const generate: GraphNode<typeof State> = (state) => {
  const version = state.version + 1

  if (version === 1) {
    // 首次生成（实际项目里调 LLM）
    return {
      draft: `【${state.topic}】LangGraph 是一个基于图结构的 AI 工作流编排框架，让你用节点和边来组织复杂的 Agent 逻辑。`,
      version,
    }
  }

  // 根据反馈修改（实际项目里把反馈传给 LLM 重新生成）
  return {
    draft: `【${state.topic}】LangGraph 是一个基于图结构的 AI 工作流编排框架。它的核心优势在于：状态管理清晰、控制流显式、支持人工介入。（根据反馈修改：${state.feedback}）`,
    version,
  }
}

// 2. 审核节点：暂停等待人工审核
const review: GraphNode<typeof State> = (state) => {
  // 把当前草稿展示给审核人，等待审核结果
  const decision = interrupt({
    message: '请审核以下文案',
    draft: state.draft,
    version: state.version,
    instruction: '回复 { approved: true } 通过，或 { approved: false, feedback: "修改建议" } 打回',
  })

  if (decision.approved) {
    return new Command({
      update: { status: 'approved', feedback: '' },
      goto: 'publish',
    })
  }

  // 打回：带着反馈回到生成节点
  return new Command({
    update: { status: 'rejected', feedback: decision.feedback ?? '请改进' },
    goto: 'generate',
  })
}

// 3. 发布节点
const publish: GraphNode<typeof State> = (state) => {
  return {
    status: 'published',
    draft: `[已发布] ${state.draft}`,
  }
}

const graph = new StateGraph(State)
  .addNode('generate', generate)
  .addNode('review', review, { ends: ['generate', 'publish'] })
  .addNode('publish', publish)
  .addEdge(START, 'generate')
  .addEdge('generate', 'review')
  .addEdge('publish', END)
  .compile({ checkpointer: new MemorySaver() })

const config = { configurable: { thread_id: 'review-001' } }

// ① 启动工作流：生成第一版 → 到审核节点暂停
await graph.invoke({ topic: 'LangGraph 简介' }, config)

let snapshot = await graph.getState(config)
const interruptInfo = snapshot.tasks[0]?.interrupts[0]?.value
console.log(interruptInfo.message)
// → '请审核以下文案'
console.log(interruptInfo.draft)
// → '【LangGraph 简介】LangGraph 是一个基于图结构的...'

// ② 审核人决定打回
await graph.invoke(
  new Command({
    resume: { approved: false, feedback: '请补充核心优势' },
  }),
  config,
)

// 图回到 generate 重新生成，然后又到 review 暂停
snapshot = await graph.getState(config)
console.log(snapshot.tasks[0]?.interrupts[0]?.value.version)
// → 2（第二版）

// ③ 审核人这次通过
const result = await graph.invoke(
  new Command({ resume: { approved: true } }),
  config,
)

console.log(result.status)
// → published
console.log(result.version)
// → 2


/**
 * interrupt 要和 checkpointer 一起用

没有 checkpointer，图暂停以后就没有地方保存状态，后面也就谈不上恢复了。所以这类图在 compile() 时都会一起把 checkpointer 配上。开发阶段可以先用 MemorySaver，真正落地时再换成持久化方案。

不要用 try/catch 包裹 interrupt

interrupt() 内部通过抛出 GraphInterrupt 错误来实现暂停。如果你用 try/catch 把它包住了，暂停机制就失效了：
 * 
 */