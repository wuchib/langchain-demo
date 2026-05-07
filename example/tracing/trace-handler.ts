import { BaseCallbackHandler } from '@langchain/core/callbacks/base'
import type { Serialized } from '@langchain/core/load/serializable'

// 复用前面定义的 Span 结构
export interface Span {
  spanId: string
  name: string
  startTime: number
  duration?: number
  status: 'ok' | 'error' | 'degraded'
  input: Record<string, any>
  output: Record<string, any>
}

interface TraceSummary {
  spanCount: number
  spans: Span[]
}

function summarizeOutput(output: unknown): string {
  const content = typeof output === 'object' && output !== null && 'content' in output
    ? (output as { content: unknown }).content
    : output

  if (typeof content === 'string') {
    return content.slice(0, 200)
  }

  if (Array.isArray(content)) {
    return content
      .map(item => typeof item === 'string' ? item : JSON.stringify(item))
      .join('')
      .slice(0, 200)
  }

  if (content == null) {
    return ''
  }

  return JSON.stringify(content).slice(0, 200)
}

export class TraceCallbackHandler extends BaseCallbackHandler {
  name = 'TraceCallbackHandler'

  // 和前面的 TraceContext 一样，收集所有 Span
  private spans: Span[] = []
  // runId → Span 的映射，用于在 end 事件里找到对应的 start
  private activeSpans = new Map<string, Span>()

  // --- 模型事件 ---

  handleChatModelStart(
    llm: Serialized,
    messages: any[][],
    runId: string
  ) {
    // 模型开始推理 → 创建一个新 Span
    const span: Span = {
      spanId: runId,
      name: `llm:${llm.id?.at(-1) ?? 'unknown'}`,
      startTime: Date.now(),
      status: 'ok',
      input: { messages },
      output: {},
    }
    this.activeSpans.set(runId, span)
  }

  handleLLMEnd(output: any, runId: string) {
    // 模型推理完成 → 填充 duration 和 output，关闭 Span
    const span = this.activeSpans.get(runId)
    if (span) {
      span.duration = Date.now() - span.startTime
      span.output = {
        text: output.generations?.[0]?.[0]?.text?.slice(0, 200),
        tokenUsage: output.llmOutput?.tokenUsage,
      }
      this.spans.push(span)
      this.activeSpans.delete(runId)
    }
  }

  handleLLMError(error: Error, runId: string) {
    const span = this.activeSpans.get(runId)
    if (span) {
      span.duration = Date.now() - span.startTime
      span.status = 'error'
      span.output = { error: error.message }
      this.spans.push(span)
      this.activeSpans.delete(runId)
    }
  }

  // --- 工具事件 ---

  handleToolStart(
    tool: Serialized,
    input: string,
    runId: string,
    _parentRunId?: string,
    _tags?: string[],
    _metadata?: Record<string, unknown>,
    runName?: string
  ) {
    const span: Span = {
      spanId: runId,
      name: `tool:${runName ?? tool.id?.at(-1) ?? 'unknown'}`,
      startTime: Date.now(),
      status: 'ok',
      input: { toolInput: input },
      output: {},
    }
    this.activeSpans.set(runId, span)
  }

  handleToolEnd(output: unknown, runId: string) {
    const span = this.activeSpans.get(runId)
    if (span) {
      span.duration = Date.now() - span.startTime
      span.output = { result: summarizeOutput(output) }
      this.spans.push(span)
      this.activeSpans.delete(runId)
    }
  }

  handleToolError(error: Error, runId: string) {
    const span = this.activeSpans.get(runId)
    if (span) {
      span.duration = Date.now() - span.startTime
      span.status = 'error'
      span.output = { error: error.message }
      this.spans.push(span)
      this.activeSpans.delete(runId)
    }
  }

  // --- 检索器事件 ---

  handleRetrieverStart(
    retriever: Serialized,
    query: string,
    runId: string
  ) {
    const span: Span = {
      spanId: runId,
      name: `retriever:${retriever.id?.at(-1) ?? 'unknown'}`,
      startTime: Date.now(),
      status: 'ok',
      input: { query },
      output: {},
    }
    this.activeSpans.set(runId, span)
  }

  handleRetrieverEnd(documents: any[], runId: string) {
    const span = this.activeSpans.get(runId)
    if (span) {
      span.duration = Date.now() - span.startTime
      span.output = {
        documentCount: documents.length,
        documents: documents.map(d => d.pageContent?.slice(0, 100)),
      }
      // 检索到了但结果为空 → 标记为 degraded
      if (documents.length === 0) {
        span.status = 'degraded'
      }
      this.spans.push(span)
      this.activeSpans.delete(runId)
    }
  }

  handleRetrieverError(error: Error, runId: string) {
    const span = this.activeSpans.get(runId)
    if (span) {
      span.duration = Date.now() - span.startTime
      span.status = 'error'
      span.output = { error: error.message }
      this.spans.push(span)
      this.activeSpans.delete(runId)
    }
  }

  // --- 对外暴露的查询方法 ---

  getSpans(): Span[] {
    return this.spans
  }

  hasError(): boolean {
    return this.spans.some(s => s.status === 'error')
  }

  hasDegraded(): boolean {
    return this.spans.some(s => s.status === 'degraded')
  }

  getTraceSummary(): TraceSummary {
    return {
      spanCount: this.spans.length,
      spans: this.spans,
    }
  }
}
