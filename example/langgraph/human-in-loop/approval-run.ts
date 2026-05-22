import { graph } from './approval-workflow'
import {
  StateGraph,
  StateSchema,
  ReducedValue,
  Command,
  interrupt,
  MemorySaver,
  START,
  END,
} from '@langchain/langgraph'
import type { GraphNode } from '@langchain/langgraph'
import { z } from 'zod'

// 整条审批链都要沿用同一个 thread_id，这样恢复时才能接回原来的流程
const config = { configurable: { thread_id: 'approval-001' } }

// ① 启动：先生成第一版，然后暂停在编辑审核
const initial = await graph.invoke({ topic: 'LangGraph 审批流入门' }, config)

let snapshot = await graph.getState(config)
console.log(snapshot.next)
// → ['editorReview']

// 第一次 invoke 返回的 __interrupt__ 就是外部界面最适合直接读取的审批信息
console.log(initial.__interrupt__)
// → {
//     stage: 'editor',
//     title: '请进行编辑审核',
//     draft: '【LangGraph 审批流入门】...',
//     version: 1,
//   }

// ② 编辑通过，继续往法务走
await graph.invoke(
  new Command({
    resume: {
      approved: true,
      reviewer: '编辑 Alice',
      comment: '内容没问题，可以继续',
    },
  }),
  config,
)

snapshot = await graph.getState(config)
console.log(snapshot.next)
// → ['legalReview']

// ③ 法务通过，图走到发布节点并结束
const result = await graph.invoke(
  new Command({
    resume: {
      approved: true,
      reviewer: '法务 Bob',
      comment: '可以发布',
    },
  }),
  config,
)

console.log(result.status)
// → published

console.log(result.reviewLogs)
// → [
//   { stage: 'editor', reviewer: '编辑 Alice', approved: true, comment: '内容没问题，可以继续' },
//   { stage: 'legal', reviewer: '法务 Bob', approved: true, comment: '可以发布' },
// ]