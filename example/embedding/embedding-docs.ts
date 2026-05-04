/**
 * 文档建索引用 embedDocuments(...)
用户查询用 embedQuery(...)
 */

/**
 * 
PDF 文档
  ↓
切成 chunks
  ↓
embedDocuments(chunks)
  ↓
存入向量库

用户问题
  ↓
embedQuery(question)
  ↓
向量相似度检索
  ↓
找出相关 chunks
  ↓
交给大模型回答
 */

import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers'

const embeddings = new HuggingFaceTransformersEmbeddings({
  // 本地跑的小模型，不需要 OpenAI API Key。第一次运行会自动下载并缓存模型文件。
  model: 'Xenova/all-MiniLM-L6-v2',
})

// 这里是知识库里的文档内容，属于“提前建索引”的阶段。
// 用于：把资料库里的内容转成向量，存进向量数据库
const docVectors = await embeddings.embedDocuments([
  '员工提交请假申请后，需要主管审批。',
  '报销流程需要上传票据和审批单。',
])

// 这里是用户实时发来的问题，属于“查询阶段”。
// 用于：把用户的问题转成向量，拿去和资料库向量做相似度搜索
const queryVector = await embeddings.embedQuery('请假要先找谁审批')

// 两条文档，所以会返回两组向量。
console.log(docVectors.length)
// 查询只有一句，所以只会得到一组向量。
console.log(queryVector.length)


