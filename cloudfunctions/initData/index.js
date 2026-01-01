let cloud, db;
try {
  cloud = require("wx-server-sdk");
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  db = cloud.database();
} catch (e) {
  // If wx-server-sdk is not available in the runtime, provide a helpful error when invoked.
  module.exports.main = async () => {
    const message =
      "Cannot find module 'wx-server-sdk'.\n" +
      "Possible causes:\n" +
      " - You're running the function in an environment that doesn't provide the SDK by default.\n" +
      " - The function package didn't include node_modules and the sdk isn't installed.\n\n" +
      "Fixes:\n" +
      " 1) If you deploy to WeChat Cloud (小程序云开发), ensure you're using the cloud function environment provided by WeChat.\n" +
      " 2) Or install the SDK locally in the function folder before deploying:\n" +
      "    cd cloudfunctions/initData\n" +
      "    npm init -y\n" +
      "    npm install wx-server-sdk --save\n" +
      "    (then upload/deploy the function including node_modules)";

    console.error(message, e && e.stack);
    return { success: false, error: message };
  };
}

/**
 * idempotent init script for development: creates sample communities, users, information, bindings
 * Run once in cloud devtools -> 云函数 -> 调用
 */
exports.main = async (event, context) => {
  const out = {
    communities: 0,
    users: 0,
    updatedUsers: 0,
    information: 0,
    bindings: 0,
    votes: 0,
    collectionsCreated: [],
    details: [],
  };
  try {
    // 首先确保所有集合存在（通过添加临时文档再删除的方式）
    const collectionsToEnsure = [
      "communities",
      "users",
      "information",
      "bindings",
      "votes",
      "vote_records",
    ];

    for (const collName of collectionsToEnsure) {
      try {
        // 尝试查询集合，如果不存在会报错
        const testQuery = await db.collection(collName).limit(1).get();
        out.details.push({
          collection: collName,
          status: "already_exists",
        });
      } catch (e) {
        // 集合不存在，创建一个临时文档然后删除
        try {
          const tempDoc = await db.collection(collName).add({
            data: { _temp: true, createdAt: new Date() },
          });
          if (tempDoc && tempDoc._id) {
            await db.collection(collName).doc(tempDoc._id).remove();
          }
          out.collectionsCreated.push(collName);
          out.details.push({
            collection: collName,
            status: "created",
          });
        } catch (createErr) {
          out.details.push({
            collection: collName,
            status: "create_failed",
            error: createErr.message,
          });
        }
      }
    }

    // sample communities
    const communities = [
      {
        name: "和平小区",
        region: ["广东省", "深圳市", "南山区"],
        address: "和平路100号",
        opened: true,
        adminCount: 0,
        maxAdmins: 10,
        createdAt: Date.now(),
      },
      {
        name: "阳光花园",
        region: ["广东省", "深圳市", "福田区"],
        address: "阳光路2号",
        opened: false,
        adminCount: 0,
        maxAdmins: 10,
        createdAt: Date.now(),
      },
    ];

    for (const c of communities) {
      const q = await db
        .collection("communities")
        .where({ name: c.name })
        .get();
      if (q && q.data && q.data.length > 0) {
        out.details.push({
          collection: "communities",
          name: c.name,
          existed: true,
        });
      } else {
        await db.collection("communities").add({ data: c });
        out.communities++;
        out.details.push({
          collection: "communities",
          name: c.name,
          created: true,
        });
      }
    }

    // sample users (包含固定 token，便于 validateToken 测试)
    const crypto = require("crypto");
    const superPassword = "SuperPass123";
    const superPasswordHash = crypto
      .createHash("sha256")
      .update(superPassword)
      .digest("hex");

    const users = [
      {
        openid: "mock_openid_1",
        nickname: "张三",
        role: "user",
        token: "testtoken123",
        createdAt: Date.now(),
      },
      {
        openid: "mock_openid_2",
        nickname: "李四",
        role: "user",
        token: "testtoken456",
        createdAt: Date.now(),
      },
      // super-admin for testing
      {
        openid: "super_admin_openid",
        nickname: "超级管理员",
        role: "super",
        token: "super-token-123",
        createdAt: Date.now(),
      },
      // super-admin credential account for password login tests
      {
        openid: "super_admin_cred",
        username: "superadmin",
        passwordHash: superPasswordHash,
        phone: "13800000000",
        nickname: "超级管理员(cred)",
        role: "super",
        token: "super-token-123",
        createdAt: Date.now(),
      },
    ];
    for (const u of users) {
      const q = await db.collection("users").where({ openid: u.openid }).get();
      if (q && q.data && q.data.length > 0) {
        const existing = q.data[0];
        // If existing user has no token, update it with our sample token (do not overwrite existing tokens)
        if (!existing.token) {
          try {
            await db
              .collection("users")
              .doc(existing._id)
              .update({ data: { token: u.token } });
            out.updatedUsers++;
            out.details.push({
              collection: "users",
              openid: u.openid,
              updatedToken: true,
            });
          } catch (e) {
            out.details.push({
              collection: "users",
              openid: u.openid,
              updatedToken: false,
              error: e && e.message,
            });
          }
        } else {
          out.details.push({
            collection: "users",
            openid: u.openid,
            existed: true,
            tokenPresent: true,
          });
        }
      } else {
        await db.collection("users").add({ data: u });
        out.users++;
        out.details.push({
          collection: "users",
          openid: u.openid,
          created: true,
        });
      }
    }

    // sample information
    const infos = [
      {
        title: "物业停水通知",
        content: "明天将停水2小时，请提前准备。",
        type: "real-time",
        pinned: false,
        createdAt: Date.now(),
      },
      {
        title: "小区年会",
        content: "下周举行小区年会，欢迎参加。",
        type: "fixed",
        pinned: true,
        createdAt: Date.now() - 1000 * 60 * 60,
      },
    ];
    for (const it of infos) {
      const q = await db
        .collection("information")
        .where({ title: it.title })
        .get();
      if (q && q.data && q.data.length > 0) {
        out.details.push({
          collection: "information",
          title: it.title,
          existed: true,
        });
      } else {
        await db.collection("information").add({ data: it });
        out.information++;
        out.details.push({
          collection: "information",
          title: it.title,
          created: true,
        });
      }
    }

    // sample binding (for mock_openid_1)
    const bindSample = {
      userOpenid: "mock_openid_1",
      communityName: "和平小区",
      region: ["广东省", "深圳市", "南山区"],
      building: "A座",
      block: "1单元",
      room: "101",
      status: "pending",
      submittedAt: Date.now(),
    };
    const bq = await db
      .collection("bindings")
      .where({ userOpenid: bindSample.userOpenid })
      .get();
    if (bq && bq.data && bq.data.length > 0) {
      out.details.push({
        collection: "bindings",
        userOpenid: bindSample.userOpenid,
        existed: true,
      });
    } else {
      await db.collection("bindings").add({ data: bindSample });
      out.bindings++;
      out.details.push({
        collection: "bindings",
        userOpenid: bindSample.userOpenid,
        created: true,
      });
    }

    // 提示信息
    out.message =
      "数据初始化完成。如果 votes 和 vote_records 集合是新创建的，现在可以正常使用投票功能了。";

    return { success: true, out };
  } catch (err) {
    console.error("initData error", err);
    return { success: false, error: err.message || err };
  }
};
