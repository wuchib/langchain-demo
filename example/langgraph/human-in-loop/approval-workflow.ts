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

const appendLogs = (
  current: Array<{
    stage: string
    reviewer: string
    approved: boolean
    comment: string
  }>,
  update: Array<{
    stage: string
    reviewer: string
    approved: boolean
    comment: string
  }>,
) => {
  return [...current, ...update]
}

const State = new StateSchema({
  topic: z.string().default(''),
  draft: z.string().default(''),
  feedback: z.string().default(''),
  version: z.number().default(0),
  status: z.string().default('drafting'),
  reviewLogs: new ReducedValue(
    z.array(
      z.object({
        stage: z.string(),
        reviewer: z.string(),
        approved: z.boolean(),
        comment: z.string(),
      }),
    ).default([]),
    { reducer: appendLogs },
  ),
})

// 生成节点：第一次生成，或者根据 feedback 重新出一版
const generateDraft: GraphNode<typeof State> = (state) => {
  const nextVersion = state.version + 1

  if (!state.feedback) {
    return {
      draft: `【${state.topic}】LangGraph 让复杂 Agent 的流程控制、状态管理和持久化都回到代码里。`,
      feedback: '',
      version: nextVersion,
      status: 'waiting-editor-review',
    }
  }

  return {
    draft: `【${state.topic}】LangGraph 让复杂 Agent 的流程控制、状态管理和持久化都回到代码里。它适合那些需要分支、暂停、恢复和审批的工作流。（本版根据反馈修改：${state.feedback}）`,
    feedback: '',
    version: nextVersion,
    status: 'waiting-editor-review',
  }
}

// 修改节点：这里只做状态切换，真正的改稿还是回 generateDraft
const reviseDraft: GraphNode<typeof State> = () => {
  return {
    status: 'revising',
  }
}

// 编辑审核：通过后去法务，打回后去修改
const editorReview: GraphNode<typeof State> = (state) => {
  const decision = interrupt({
    stage: 'editor',
    title: '请进行编辑审核',
    draft: state.draft,
    version: state.version,
    instruction: '回复 { approved: true, reviewer, comment } 或 { approved: false, reviewer, comment }',
  })

  if (decision.approved) {
    return new Command({
      update: {
        status: 'waiting-legal-review',
        reviewLogs: [{
          stage: 'editor',
          reviewer: decision.reviewer,
          approved: true,
          comment: decision.comment ?? '',
        }],
      },
      goto: 'legalReview',
    })
  }

  return new Command({
    update: {
      status: 'editor-rejected',
      feedback: decision.comment ?? '请继续修改',
      reviewLogs: [{
        stage: 'editor',
        reviewer: decision.reviewer,
        approved: false,
        comment: decision.comment ?? '',
      }],
    },
    goto: 'reviseDraft',
  })
}

// 法务审核：通过后发布，打回后也回修改
const legalReview: GraphNode<typeof State> = (state) => {
  const decision = interrupt({
    stage: 'legal',
    title: '请进行法务审核',
    draft: state.draft,
    version: state.version,
    instruction: '回复 { approved: true, reviewer, comment } 或 { approved: false, reviewer, comment }',
  })

  if (decision.approved) {
    return new Command({
      update: {
        status: 'approved',
        reviewLogs: [{
          stage: 'legal',
          reviewer: decision.reviewer,
          approved: true,
          comment: decision.comment ?? '',
        }],
      },
      goto: 'publish',
    })
  }

  return new Command({
    update: {
      status: 'legal-rejected',
      feedback: decision.comment ?? '请继续修改',
      reviewLogs: [{
        stage: 'legal',
        reviewer: decision.reviewer,
        approved: false,
        comment: decision.comment ?? '',
      }],
    },
    goto: 'reviseDraft',
  })
}

const publish: GraphNode<typeof State> = (state) => {
  return {
    status: 'published',
    draft: `[已发布 V${state.version}] ${state.draft}`,
  }
}

export const graph = new StateGraph(State)
  .addNode('generateDraft', generateDraft)
  .addNode('reviseDraft', reviseDraft)
  .addNode('editorReview', editorReview, { ends: ['legalReview', 'reviseDraft'] })
  .addNode('legalReview', legalReview, { ends: ['publish', 'reviseDraft'] })
  .addNode('publish', publish)
  .addEdge(START, 'generateDraft')
  .addEdge('generateDraft', 'editorReview')
  .addEdge('reviseDraft', 'generateDraft')
  .addEdge('publish', END)
  .compile({ checkpointer: new MemorySaver() })