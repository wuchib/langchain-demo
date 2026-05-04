

import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers'

const embeddings = new HuggingFaceTransformersEmbeddings({
  // 本地跑的小模型，不需要 OpenAI API Key。第一次运行会自动下载并缓存模型文件。
  model: 'Xenova/all-MiniLM-L6-v2',
})

// 用户问题进入检索前，先会被转成向量。
const vector = await embeddings.embedQuery('请假流程怎么走')

// 向量维度是固定的，后面相似度比较就在这个数字空间里完成。
console.log(vector.length)
// 这里只是随便看几个值，实际项目里不会手动处理这些数字。
console.log(vector.slice(0, 5))
