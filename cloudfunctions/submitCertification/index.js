const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * submitCertification
 * 提交认证申请（户主或家属）或提交实名认证资料
 *
 * 户主注册参数:
 * - type: 'owner'
 * - name: 姓名
 * - phone: 手机号
 * - region: [省, 市, 区]
 * - communityName: 小区名称
 * - district: 片区
 * - building: 栋号
 * - unit: 单元号
 * - room: 房号
 *
 * 家属注册参数:
 * - type: 'family'
 * - inviteCode: 邀请码
 * - name: 姓名
 * - phone: 手机号
 * - relation: 与户主关系
 *
 * 商铺注册参数（与户主房屋认证完全隔离，写入 shop_certification_applications）:
 * - type: 'shop'
 * - name: 姓名
 * - phone: 手机号
 * - region: [省, 市, 区]
 * - properties: [{ communityName, houseNumber, shopName }]  // 门牌号/商铺名选填（后台无配置时可为空）
 *
 * 实名认证参数:
 * - type: 'realname'
 * - idCardFront: 身份证正面URL
 * - idCardBack: 身份证反面URL
 * - certType: property|contract|payment
 * - certImage: 证明图片URL
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;

    if (!openid) {
      return { code: -1, message: "无法获取用户身份" };
    }

    const { type } = event;

    if (type === "owner") {
      return await handleOwnerCertification(openid, event);
    } else if (type === "shop") {
      return await handleShopCertification(openid, event);
    } else if (type === "family") {
      return await handleFamilyCertification(openid, event);
    } else if (type === "realname") {
      return await handleRealNameCertification(openid, event);
    } else {
      return { code: -1, message: "未知的认证类型" };
    }
  } catch (error) {
    console.error("submitCertification error:", error);
    return { code: -1, message: error.message || "提交失败" };
  }
};

/**
 * 处理户主认证
 */
async function handleOwnerCertification(openid, event) {
  const { name, phone, region, properties } = event;

  // 验证必填字段
  if (!name || !phone || !properties || properties.length === 0) {
    return { code: -1, message: "请填写完整信息" };
  }

  // 验证手机号格式
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(phone)) {
    return { code: -1, message: "手机号格式不正确" };
  }

  // 处理每个房产
  const now = new Date().toISOString();
  const applications = [];

  for (const property of properties) {
    const { communityName, building, unit, room } = property;

    // 查询小区信息获取communityId
    const communityRes = await db
      .collection("communities")
      .where({ name: communityName })
      .limit(1)
      .get();

    if (!communityRes.data || communityRes.data.length === 0) {
      return { code: -1, message: `未找到小区：${communityName}` };
    }

    const community = communityRes.data[0];
    const communityId = community._id;

    // 检查该用户在当前小区是否已有待审核或已通过的申请
    const userApplicationRes = await db
      .collection("certification_applications")
      .where({
        openid,
        communityId,
        type: "owner",
        status: db.command.in(["pending", "approved"]),
      })
      .limit(1)
      .get();

    if (userApplicationRes.data && userApplicationRes.data.length > 0) {
      const existing = userApplicationRes.data[0];
      if (existing.status === "approved") {
        return { code: -1, message: `您在${communityName}小区已完成认证` };
      } else {
        return {
          code: -1,
          message: `您在${communityName}小区已有待审核的申请，请等待审核结果`,
        };
      }
    }

    // 检查该房号是否已被认证
    const houseRes = await db
      .collection("certification_applications")
      .where({
        communityId,
        building,
        unit,
        room,
        status: "approved",
        type: "owner",
      })
      .limit(1)
      .get();

    if (houseRes.data && houseRes.data.length > 0) {
      return {
        code: -1,
        message: `${building}栋${unit}单元${room}室已有户主认证`,
      };
    }

    applications.push({
      openid,
      type: "owner",
      name,
      phone,
      region: region || [],
      communityId,
      communityName,
      building,
      unit,
      room,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  }

  // 批量创建认证申请
  for (const application of applications) {
    await db.collection("certification_applications").add({
      data: application,
    });
  }

  return {
    code: 0,
    message: `已提交${applications.length}套房产的认证申请，请等待审核`,
  };
}

/**
 * 处理商铺认证（商铺角色注册）
 * 与户主房屋认证（certification_applications）完全隔离，写入 shop_certification_applications
 */
async function handleShopCertification(openid, event) {
  const { name, phone, region, properties } = event;

  // 验证必填字段
  if (!name || !phone || !properties || properties.length === 0) {
    return { code: -1, message: "请填写完整信息" };
  }

  // 验证手机号格式
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(phone)) {
    return { code: -1, message: "手机号格式不正确" };
  }

  // 处理每个商铺
  const now = new Date().toISOString();
  const applications = [];

  for (const property of properties) {
    const { communityName, houseNumber, shopName } = property;

    // 门牌号、商铺名选填（后台无配置时可为空），但二者不能同时为空
    if (!communityName || (!houseNumber && !shopName)) {
      return { code: -1, message: "请填写完整的商铺信息" };
    }

    // 查询小区信息获取communityId
    const communityRes = await db
      .collection("communities")
      .where({ name: communityName })
      .limit(1)
      .get();

    if (!communityRes.data || communityRes.data.length === 0) {
      return { code: -1, message: `未找到小区：${communityName}` };
    }

    const community = communityRes.data[0];
    const communityId = community._id;

    // 检查该用户在当前小区是否已有待审核或已通过的商铺申请
    const userApplicationRes = await db
      .collection("shop_certification_applications")
      .where({
        openid,
        communityId,
        status: db.command.in(["pending", "approved"]),
      })
      .limit(1)
      .get();

    if (userApplicationRes.data && userApplicationRes.data.length > 0) {
      const existing = userApplicationRes.data[0];
      if (existing.status === "approved") {
        return { code: -1, message: `您在${communityName}小区已完成商铺认证` };
      } else {
        return {
          code: -1,
          message: `您在${communityName}小区已有待审核的商铺申请，请等待审核结果`,
        };
      }
    }

    // 检查本次请求内是否已包含相同商铺（循环内去重，防止同一批提交重复商铺）
    if (
      applications.some(
        (a) =>
          a.houseNumber === (houseNumber || "") &&
          a.shopName === (shopName || ""),
      )
    ) {
      return { code: -1, message: "提交的商铺信息重复，请检查后重试" };
    }

    // 检查该商铺是否已有认证申请（待审核或已通过均占用；门牌号/商铺名均非空时校验，避免空值互相误撞）
    if (houseNumber || shopName) {
      const shopRes = await db
        .collection("shop_certification_applications")
        .where({
          communityId,
          houseNumber: houseNumber || "",
          shopName: shopName || "",
          status: db.command.in(["pending", "approved"]),
        })
        .limit(1)
        .get();

      if (shopRes.data && shopRes.data.length > 0) {
        return {
          code: -1,
          message: `门牌号"${houseNumber || "-"}"商铺名"${shopName || "-"}"已有认证申请`,
        };
      }
    }

    applications.push({
      openid,
      type: "shop",
      name,
      phone,
      region: region || [],
      communityId,
      communityName,
      houseNumber: houseNumber || "",
      shopName: shopName || "",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  }

  // 批量创建商铺认证申请
  for (const application of applications) {
    await db.collection("shop_certification_applications").add({
      data: application,
    });
  }

  return {
    code: 0,
    message: `已提交${applications.length}个商铺的认证申请，请等待审核`,
  };
}

/**
 * 处理家属认证
 */
async function handleFamilyCertification(openid, event) {
  const { inviteCode, name, phone, relation } = event;

  // 验证必填字段
  if (!inviteCode || !name || !phone) {
    return { code: -1, message: "请填写完整信息" };
  }

  // 验证手机号格式
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(phone)) {
    return { code: -1, message: "手机号格式不正确" };
  }

  // 验证邀请码
  const inviteRes = await db
    .collection("family_invite_codes")
    .where({ code: inviteCode })
    .limit(1)
    .get();

  if (!inviteRes.data || inviteRes.data.length === 0) {
    return { code: -1, message: "邀请码无效" };
  }

  const invite = inviteRes.data[0];

  // 检查邀请码是否过期
  if (new Date(invite.expiresAt) < new Date()) {
    return { code: -1, message: "邀请码已过期" };
  }

  // 检查邀请码是否已使用
  if (invite.status === "used") {
    return { code: -1, message: "邀请码已被使用" };
  }

  // 使用邀请码中记录的小区ID，不再重新查户主（避免跨小区问题）
  const targetCommunityId = invite.communityId;

  // 检查该用户在目标小区是否已有待审核或已通过的申请
  const existingRes = await db
    .collection("certification_applications")
    .where({
      openid,
      communityId: targetCommunityId,
      status: db.command.in(["pending", "approved"]),
    })
    .limit(1)
    .get();

  if (existingRes.data && existingRes.data.length > 0) {
    const existing = existingRes.data[0];
    if (existing.status === "approved") {
      return {
        code: -1,
        message: `您在该小区已完成认证`,
      };
    } else {
      return {
        code: -1,
        message: `您在该小区已有待审核的申请，请等待审核结果`,
      };
    }
  }

  // 创建家属认证申请（自动通过，使用邀请码中记录的小区信息）
  const now = new Date().toISOString();
  const application = {
    openid,
    type: "family",
    name,
    phone,
    relation: relation || "其他家庭成员",
    ownerOpenid: invite.ownerOpenid,
    ownerName: invite.ownerName || "",
    communityId: invite.communityId,
    communityName: invite.communityName || "",
    district: invite.district || "",
    building: invite.building || "",
    unit: invite.unit || "",
    room: invite.room || "",
    inviteCode,
    status: "approved", // 自动通过，不需要户主审核
    createdAt: now,
    updatedAt: now,
  };

  await db.collection("certification_applications").add({
    data: application,
  });

  // 标记邀请码为已使用
  await db
    .collection("family_invite_codes")
    .doc(invite._id)
    .update({
      data: {
        status: "used",
        usedBy: openid,
        usedAt: now,
        updatedAt: now,
      },
    });

  return {
    code: 0,
    message: "注册成功，您已成为该户主的家属成员",
    data: {
      communityId: invite.communityId,
      communityName: invite.communityName || "",
    },
  };
}

/**
 * 处理实名认证资料提交
 */
async function handleRealNameCertification(openid, event) {
  const { idCardFront, idCardBack, certType, certImage } = event;

  // 验证必填字段
  if (!idCardFront || !idCardBack || !certType || !certImage) {
    return {
      success: false,
      message: "请上传完整的认证资料",
    };
  }

  // 验证certType
  const validCertTypes = ["property", "contract", "payment"];
  if (!validCertTypes.includes(certType)) {
    return {
      success: false,
      message: "无效的证明类型",
    };
  }

  // 先查询 certification_applications 集合（户主认证申请）
  const certAppRes = await db
    .collection("certification_applications")
    .where({
      openid: openid,
      type: "owner",
      status: "approved",
    })
    .orderBy("submitTime", "desc")
    .limit(1)
    .get();

  let ownerId = null;

  if (certAppRes.data.length > 0) {
    const certApp = certAppRes.data[0];

    // 如果认证申请有 ownerId，使用它
    if (certApp.ownerId) {
      ownerId = certApp.ownerId;
    } else {
      // 如果没有 ownerId，通过房号信息查找 owner_registry
      const ownerQueryRes = await db
        .collection("owner_registry")
        .where({
          communityId: certApp.communityId,
          building: certApp.building,
          unit: certApp.unit,
          room: certApp.room,
        })
        .limit(1)
        .get();

      if (ownerQueryRes.data.length > 0) {
        ownerId = ownerQueryRes.data[0]._id;
      } else {
        // 如果还没有创建 owner_registry 记录，现在创建一个
        const now = new Date().toISOString();
        const ownerData = {
          name: certApp.name,
          phone: certApp.phone,
          openid: certApp.openid,
          communityId: certApp.communityId,
          communityName: certApp.communityName,
          district: certApp.district || "",
          building: certApp.building,
          unit: certApp.unit,
          room: certApp.room,
          region: certApp.region || [],
          createdAt: now,
          updatedAt: now,
        };

        const addOwnerRes = await db.collection("owner_registry").add({
          data: ownerData,
        });

        ownerId = addOwnerRes._id;

        // 同时更新 certification_applications 中的 ownerId
        await db
          .collection("certification_applications")
          .doc(certApp._id)
          .update({
            data: {
              ownerId: ownerId,
              updatedAt: now,
            },
          });
      }
    }
  } else {
    // 如果没有找到已通过的认证申请
    const pendingRes = await db
      .collection("certification_applications")
      .where({
        openid: openid,
        type: "owner",
        status: "pending",
      })
      .limit(1)
      .get();

    if (pendingRes.data.length > 0) {
      return {
        success: false,
        message: "户主认证审核中，请等待审核通过后再提交实名认证",
      };
    }

    // 尝试查询 bindings 集合（旧系统兼容）
    const bindingRes = await db
      .collection("bindings")
      .where({
        openid: openid,
      })
      .get();

    if (bindingRes.data.length === 0) {
      // 商铺认证兼容：查询商铺认证申请（shop_certification_applications）
      const shopCertRes = await db
        .collection("shop_certification_applications")
        .where({
          openid: openid,
          status: "approved",
        })
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

      if (shopCertRes.data.length > 0) {
        const shopCert = shopCertRes.data[0];

        // 通过门牌号+商铺名查找商铺名册记录
        let shopRegId = null;
        const shopRegQueryRes = await db
          .collection("shop_registry")
          .where({
            communityId: shopCert.communityId,
            houseNumber: shopCert.houseNumber || "",
            shopName: shopCert.shopName || "",
          })
          .limit(1)
          .get();

        if (shopRegQueryRes.data.length > 0) {
          shopRegId = shopRegQueryRes.data[0]._id;
        } else {
          // 商铺名册无记录时创建一条（与户主实名提交行为一致）
          const now = new Date().toISOString();
          const shopData = {
            communityId: shopCert.communityId,
            ownerName1: shopCert.name,
            ownerName2: "",
            houseNumber: shopCert.houseNumber || "",
            shopName: shopCert.shopName || "",
            area: 0,
            remark: "",
            status: "valid",
            openid: openid,
            createdAt: now,
            updatedAt: now,
          };
          const addShopRes = await db.collection("shop_registry").add({
            data: shopData,
          });
          shopRegId = addShopRes._id;
        }

        const now = new Date().toISOString();
        // 更新商铺名册实名认证状态
        await db
          .collection("shop_registry")
          .doc(shopRegId)
          .update({
            data: {
              realNameStatus: "pending",
              realNameIdCardFront: idCardFront,
              realNameIdCardBack: idCardBack,
              realNameCertType: certType,
              realNameCertImage: certImage,
              realNameSubmitTime: now,
              realNameRejectReason: "",
              updatedAt: now,
            },
          });

        // 同时更新商铺户主名单（该 openid 的所有记录）
        const shopOwnerListRes = await db
          .collection("shop_owner_list")
          .where({
            openid: openid,
          })
          .get();

        if (shopOwnerListRes.data && shopOwnerListRes.data.length > 0) {
          const updatePromises = shopOwnerListRes.data.map((owner) =>
            db.collection("shop_owner_list").doc(owner._id).update({
              realNameStatus: "pending",
              realNameIdCardFront: idCardFront,
              realNameIdCardBack: idCardBack,
              realNameCertType: certType,
              realNameCertImage: certImage,
              realNameSubmitTime: now,
              realNameRejectReason: "",
              updatedAt: now,
            }),
          );
          await Promise.all(updatePromises);
        }

        return {
          success: true,
          message: "提交成功，请等待审核",
        };
      }

      return {
        success: false,
        message: "未找到户主认证信息，请先完成户主认证",
      };
    }

    ownerId = bindingRes.data[0].ownerId;
  }

  // 确保 ownerId 有效
  if (!ownerId) {
    return {
      success: false,
      message: "无法获取户主信息，请联系管理员",
    };
  }

  // 更新 owner_registry 表中的实名认证状态
  const now = new Date().toISOString();
  await db
    .collection("owner_registry")
    .doc(ownerId)
    .update({
      data: {
        realNameStatus: "pending",
        realNameIdCardFront: idCardFront,
        realNameIdCardBack: idCardBack,
        realNameCertType: certType,
        realNameCertImage: certImage,
        realNameSubmitTime: now,
        realNameRejectReason: "", // 清空之前的拒绝原因
        updatedAt: now,
      },
    });

  // 同时更新 owner_list 集合（如果存在）- 更新该用户的所有房产记录
  const ownerListRes = await db
    .collection("owner_list")
    .where({
      openid: openid,
    })
    .get();

  if (ownerListRes.data && ownerListRes.data.length > 0) {
    // 更新所有匹配的记录（用户可能有多套房产）
    const updatePromises = ownerListRes.data.map((owner) =>
      db.collection("owner_list").doc(owner._id).update({
        realNameStatus: "pending",
        realNameIdCardFront: idCardFront,
        realNameIdCardBack: idCardBack,
        realNameCertType: certType,
        realNameCertImage: certImage,
        realNameSubmitTime: now,
        realNameRejectReason: "",
        updatedAt: now,
      }),
    );
    await Promise.all(updatePromises);
  }

  return {
    success: true,
    message: "提交成功，请等待审核",
  };
}
