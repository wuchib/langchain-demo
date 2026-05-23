import {
  StateGraph,
  StateSchema,
  ReducedValue,
  START,
  END,
  Command,
} from "@langchain/langgraph";
import type { GraphNode, ConditionalEdgeRouter } from "@langchain/langgraph";
import { z } from "zod";

const appendMessages = (
  current: Array<{ role: "user" | "assistant"; content: string }>,
  update: Array<{ role: "user" | "assistant"; content: string }>,
) => {
  return [...current, ...update];
};

const State = new StateSchema({
  activeAgent: z.enum(["general", "travel"]).default("general"),
  messages: new ReducedValue(
    z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        }),
      )
      .default([]),
    { reducer: appendMessages },
  ),
});

const generalAgent: GraphNode<typeof State> = (state) => {
  const lastMessage = state.messages.at(-1)?.content ?? "";

  // 如果用户已经明确在聊旅行，这里就不继续硬接了
  if (
    lastMessage.includes("旅行") ||
    lastMessage.includes("机票") ||
    lastMessage.includes("酒店")
  ) {
    return new Command({
      update: {
        activeAgent: "travel",
        messages: [
          {
            role: "assistant",
            content: "接下来由旅行助理继续帮你安排行程。",
          },
        ],
      },
      goto: "travelAgent",
    });
  }

  return {
    messages: [
      {
        role: "assistant",
        content:
          "我先帮你判断一下需求方向，如果是旅行规划，我会把对话切给旅行助理。",
      },
    ],
  };
};

const travelAgent: GraphNode<typeof State> = (state) => {
  const lastMessage = state.messages.at(-1)?.content ?? "";

  // 这里假设控制权已经切到了旅行角色，
  // 所以后面的回复会直接站在旅行助理的视角继续往下接
  return {
    messages: [
      {
        role: "assistant",
        content: `旅行助理已接手，当前收到的新要求是：${lastMessage}`,
      },
    ],
  };
};

const shouldContinue: ConditionalEdgeRouter<typeof State> = (state) => {
  if (state.activeAgent === "travel") return "travelAgent";
  return END;
};

const graph = new StateGraph(State)
  .addNode("generalAgent", generalAgent, { ends: ["travelAgent"] })
  .addNode("travelAgent", travelAgent)
  .addEdge(START, "generalAgent")
  .addConditionalEdges("generalAgent", shouldContinue, ["travelAgent"])
  .addEdge("travelAgent", END)
  .compile();

let state = await graph.invoke({
  messages: [{ role: "user", content: "我想做一个日本旅行规划。" }],
});

console.log(state.activeAgent);
// → travel

state = await graph.invoke({
  // 这里把当前活跃角色继续传回去，
  // 所以下一轮不会再回到 generalAgent 重新判断
  activeAgent: state.activeAgent,
  messages: [{ role: "user", content: "预算尽量控制在五千以内。" }],
});

console.log(state.messages.at(-1)?.content);
// → 旅行助理已接手，当前收到的新要求是：预算尽量控制在五千以内。

/*
-  什么时候适合 handoff，什么时候更像 swarm
可以把这两个模式放回使用感受里看。

如果你的系统里仍然有一个比较明确的起点角色，只是中途会把用户带进某个更专业的角色里继续聊，那通常还是 handoff 更贴切。

如果你的系统里，多个角色本来就可能互相接力，而且你不太想设一个永远站在最上面的总控，那它就会越来越像 swarm。

所以区别不在于「有没有多个 Agent」，而在于：

控制权是一次性交出去，还是可能在多个角色之间持续流动。
*/