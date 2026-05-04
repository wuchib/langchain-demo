/**
 * Loader 负责把文件变成 Document[]
Splitter 负责把 Document[] 切成更小的 Document[]
 */

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const pdfPath = join(currentDir, "入门前端.pdf");

// 这一层还是知识准备阶段，不是实时问答阶段。
// 所以代码目标很明确：先把文档整理成适合后面建索引的 chunks。
const loader = new PDFLoader(pdfPath);

const splitter = new RecursiveCharacterTextSplitter({
  // 每块不要太大，后面检索出来才容易聚焦。
  chunkSize: 900,
  // 留一点重叠，避免一句完整的话刚好被切断。
  chunkOverlap: 120,
});

async function prepareKnowledgeBase() {
  // 1. 先把原始文档读成 Document[]。
  const rawDocs = await loader.load();

  // 2. 再把长文档切成更小的块。
  // splitDocuments 会保留原来每个 Document 的 metadata。
  const chunks = await splitter.splitDocuments(rawDocs);

  // 3. 这里顺手把每个块整理成我们自己更容易处理的结构。
  // 后面做 embedding、写向量库、调试来源信息，都会用到这些字段。
  return chunks.map((doc, index) => ({
    // id 先用顺序号演示，真实项目里通常会拼 source + chunkIndex。
    id: `handbook-${index}`,
    // pageContent 是后面真正要做 embedding 的正文。
    pageContent: doc.pageContent,
    // metadata 则继续保留来源信息，方便后面回溯这块是从哪里切出来的。
    metadata: doc.metadata,
  }));
}

// 真正执行一次知识准备流程。
// 走完这里以后，chunks 就已经是后面做 embedding 和写向量库的输入了。
const chunks = await prepareKnowledgeBase();

// 先看总量，确认这份手册最终被切成了多少块。
console.log(chunks.length);
// 再看第一块长什么样，顺手检查正文和 metadata 有没有一起保留下来。
chunks.forEach((chunk) => {
  console.log(chunk);
});
