import { createAgent } from "langchain";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Document } from "@langchain/core/documents";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";
dotenv.config({ path: new URL("../../.env.local", import.meta.url) });

const model = new ChatOpenAI({
  model: "deepseek-chat",
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
  },
});
const embeddings = new HuggingFaceTransformersEmbeddings({
  model: "Xenova/all-MiniLM-L6-v2",
});

// 这里先准备一份很小的知识库。
// 实际项目里，这些 Document 往往来自前面那篇的切块结果。
const vectorStore = await MemoryVectorStore.fromDocuments(
  [
    new Document({
      pageContent: "员工提交请假申请后，需要直属主管审批。",
      metadata: { source: "handbook.pdf", topic: "leave" },
    }),
    new Document({
      pageContent: "调休申请通过后，系统会自动更新剩余工时。",
      metadata: { source: "handbook.pdf", topic: "leave" },
    }),
    new Document({
      pageContent: "报销时需要上传票据和审批单。",
      metadata: { source: "handbook.pdf", topic: "expense" },
    }),
  ],
  embeddings,
);

const agent = createAgent({
  model,
  tools: [],
});

async function answerWithKnowledge(question: string) {
  // 1. 先检索最相关的文档块。
  const docs = await vectorStore.similaritySearch(question, 2);

  // 2. 再把检索结果拼成一段可读上下文。
  // 这里不直接把 Document[] 原样塞给 Agent，是为了让 system 更清楚。
  const context = docs
    .map((doc, index) => {
      return `资料 ${index + 1}：${doc.pageContent}`;
    })
    .join("\n\n");

  const result = await agent.invoke({
    messages: [
      {
        // system 负责告诉 Agent：哪些内容是参考资料，以及回答时要遵守什么边界。
        role: "system",
        content: `你是公司的 AI 助手。

请优先根据下面的参考资料回答问题。
如果资料里没有明确答案，就直接说不知道，不要编造。

参考资料：
${context}`,
      },
      {
        // user 仍然是用户原始问题，不需要改写。
        role: "user",
        content: question,
      },
    ],
  });

  // 3. 最后一条消息就是本轮回答。
  return result.messages.at(-1)?.text ?? "";
}

const answer = await answerWithKnowledge("请假要先找谁审批？");
// 这里看到的结果，已经是“检索 + 回答”合起来后的最终输出。
console.log(answer);
