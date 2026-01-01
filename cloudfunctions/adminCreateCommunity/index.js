const cloud = require("wx-server-sdk");
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const { adminToken, community } = event || {};
    // 注意：token 验证已在 server.js 中完成，此处不再重复验证
    if (!community || !community.name)
      return { success: false, error: "missing community data" };

    const now = new Date();
    const start = community.startDate ? new Date(community.startDate) : now;
    const end = community.endDate
      ? new Date(community.endDate)
      : new Date(now.getTime() + 365 * 24 * 3600 * 1000);
    const remainingMs = Math.max(0, end.getTime() - start.getTime());
    const remainingDays = Math.ceil(remainingMs / (24 * 3600 * 1000));

    // Restructure: compute default admin info first (if provided)
    let finalUsername = null;
    let plainPassword = null;
    let passwordHash = null;
    if (
      community.defaultAdmin &&
      community.defaultAdmin.username &&
      community.defaultAdmin.password
    ) {
      const baseUsername = String(community.defaultAdmin.username).trim();
      const exist = await db
        .collection("users")
        .where({ username: baseUsername })
        .limit(1)
        .get();
      finalUsername =
        exist && exist.data && exist.data.length > 0
          ? `${baseUsername}${Math.floor(Math.random() * 1000)}`
          : baseUsername;
      plainPassword = String(community.defaultAdmin.password);
      const crypto = require("crypto");
      passwordHash = crypto
        .createHash("sha256")
        .update(plainPassword)
        .digest("hex");
    }

    // Insert community with adminUsername/adminPasswordPlain directly if present
    const addRes = await db.collection("communities").add({
      data: {
        name: community.name,
        region: community.region || [],
        address: community.address || "",
        productStart: start,
        productEnd: end,
        remainingDays,
        maxAdmins: community.maxAdmins || 10,
        adminCount: finalUsername ? 1 : 0,
        adminUsername: finalUsername || null,
        adminPasswordPlain: plainPassword || null, // 明文初始密码（仅用于首次查看/回显）
        ownerName: community.ownerName || null,
        ownerPhone: community.ownerPhone || null,
        meta: community.meta || {},
        createdAt: now,
        updatedAt: now,
      },
    });

    let out = {
      success: true,
      id: addRes.id,
      remainingDays,
      adminUsername: finalUsername || null,
    };

    // Create primary admin user referencing communityId
    if (finalUsername && passwordHash) {
      const ures = await db.collection("users").add({
        data: {
          username: finalUsername,
          passwordHash,
          role: "community",
          communityId: addRes._id || addRes.id,
          mustChangePassword: true,
          isPrimaryAdmin: true,
          permissions: [
            "vote",
            "survey",
            "service_evaluation",
            "property_evaluation",
            "repair",
            "report",
            "announcement",
          ],
          createdAt: now,
          updatedAt: now,
        },
      });
      out.primaryAdminUserId = ures._id || ures.id;
    }

    return out;
  } catch (e) {
    return { success: false, error: e.message || e };
  }
};
