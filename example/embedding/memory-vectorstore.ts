import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory'
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers'
import { Document } from '@langchain/core/documents'

const embeddings = new HuggingFaceTransformersEmbeddings({
  model: 'Xenova/all-MiniLM-L6-v2',
})

// fromDocuments 会把文档先做 embedding，
// 再把“文档 + 向量”一起放进内存向量库。
const vectorStore = await MemoryVectorStore.fromDocuments(
  [
    new Document({
      // 这里的正文，后面会参与向量检索。
      pageContent: '员工提交请假申请后，需要直属主管审批。',
      // metadata 不参与语义匹配，但后面可以拿来显示来源或分类。
      metadata: { source: 'handbook.pdf', topic: 'leave' },
    }),
    new Document({
      pageContent: '报销时需要上传票据和审批单。',
      metadata: { source: 'handbook.pdf', topic: 'expense' },
    }),
    new Document({
      pageContent: '调休申请通过后，系统会自动更新剩余工时。',
      metadata: { source: 'handbook.pdf', topic: 'leave' },
    }),
  ],
  embeddings,
)

// console.log(vectorStore);

// 这里还是检索阶段，Agent 还没有开始回答。
const docs = await vectorStore.similaritySearch('请假要先找谁审批', 2)

docs.forEach((doc) => {
  // pageContent 是真正检索命中的正文。
  console.log(doc.pageContent)
  // metadata 方便你确认它是从哪份资料、哪个主题里取回来的。
  // console.log(doc.metadata)
})
