import { LangfuseSpanProcessor } from '@langfuse/otel'
import { NodeSDK } from '@opentelemetry/sdk-node'
import dotenv from 'dotenv'

dotenv.config({ path: new URL('../../.env.local', import.meta.url) })

// Langfuse v5 基于 OpenTelemetry。CallbackHandler 负责创建 span，
// LangfuseSpanProcessor 负责把这些 span 批量发送到 Langfuse。
export const langfuseSdk = process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY
  ? new NodeSDK({
      spanProcessors: [
        new LangfuseSpanProcessor({
          publicKey: process.env.LANGFUSE_PUBLIC_KEY,
          secretKey: process.env.LANGFUSE_SECRET_KEY,
          baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
          // 示例脚本是短进程，immediate 可以减少退出前丢 span 的概率。
          exportMode: 'immediate',
        }),
      ],
    })
  : undefined

langfuseSdk?.start()
