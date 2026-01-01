// 测试投票管理功能的示例数据
// 可以在浏览器控制台或Node.js环境中运行

const testVoteData = {
  // 投票表决示例
  voteExample: {
    type: "vote",
    title: "关于小区公共区域改造方案的表决",
    detail:
      "根据业主大会决议，拟对小区公共区域进行改造，包括：\n1. 增设儿童游乐设施\n2. 改造绿化带\n3. 增加停车位\n\n预算：50万元\n工期：3个月",
    attachment: "",
    attachmentName: "",
    initiator: "业委会",
    publishTime: new Date().toISOString(),
    deadlineTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    description:
      "请各位业主认真阅读改造方案，并在截止时间前投票表决。投票结果将作为是否实施改造的依据。",
    showResult: true,
  },

  // 问卷调查示例
  surveyExample: {
    type: "survey",
    title: "小区物业服务满意度调查",
    detail:
      "为了更好地为业主提供服务，特开展本次满意度调查。请您对以下服务项目进行评价：\n1. 保安服务\n2. 保洁服务\n3. 绿化养护\n4. 设施维护",
    attachment: "",
    attachmentName: "",
    initiator: "物业公司",
    publishTime: new Date().toISOString(),
    deadlineTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    description: "您的意见对我们很重要，感谢您的参与！",
    showResult: false,
  },

  // 测试投票记录（用于统计测试）
  voteRecords: [
    { choice: "agree", area: 120.5 }, // 同意，专有面积120.5㎡
    { choice: "agree", area: 95.3 }, // 同意，专有面积95.3㎡
    { choice: "disagree", area: 88.6 }, // 不同意，专有面积88.6㎡
    { choice: "abstain", area: 110.2 }, // 弃权，专有面积110.2㎡
    { choice: "agree", area: 135.0 }, // 同意，专有面积135.0㎡
  ],
};

// 使用fetch API创建投票的示例代码
async function createTestVote(voteData, token) {
  const user = JSON.parse(localStorage.getItem("admin-user") || "{}");

  const response = await fetch("/api/votes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      communityId: user.communityId,
      ...voteData,
    }),
  });

  const result = await response.json();
  console.log("创建投票结果:", result);
  return result;
}

// 在浏览器控制台中运行：
// const token = localStorage.getItem("admin-token");
// createTestVote(testVoteData.voteExample, token);
// createTestVote(testVoteData.surveyExample, token);

console.log("测试数据已准备就绪！");
console.log("投票表决示例:", testVoteData.voteExample);
console.log("问卷调查示例:", testVoteData.surveyExample);
