/**
 * 门禁权限管理工具
 * 封装 Fondcard 用户创建/吊销 和 Key 绑定/推送 逻辑
 */

const { db } = require("../config/db");
const { FondcardClient } = require("./fondcard-client");

function toHex8(numValue) {
  const n = Number(numValue);
  if (!Number.isFinite(n)) return null;
  return n.toString(16).toUpperCase().padStart(8, "0").slice(-8);
}

function normalizeNo(value) {
  if (value === undefined || value === null) return "";
  const str = String(value).trim();
  if (!str) return "";
  const digits = str.match(/\d+/g);
  if (!digits || !digits.length) return str;
  return String(parseInt(digits.join(""), 10));
}

function buildUnitKey(building, unit) {
  const b = normalizeNo(building);
  const u = normalizeNo(unit);
  if (!b || !u) return "";
  return `${b}#${u}`;
}

/**
 * 为单台设备添加 Key 并通过 MQTT 推送
 * @param {FondcardClient} client
 * @param {object} device - door_devices 记录
 * @param {string} keyId  - toHex8(fondcardId)
 * @param {string|number} userId - fondcardId
 */
async function bindKeyToDevice(client, device, keyId, userId) {
  const deviceSerial = device.serial;
  const devicePassword =
    device.password || (device.openParams && device.openParams.password) || "";

  if (!deviceSerial || !devicePassword) {
    console.warn(
      `[door-permissions] device ${device._id} missing serial/password, skip`,
    );
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const defaultKeyDate = Math.floor(
    (Date.now() + 10 * 365 * 24 * 60 * 60 * 1000) / 1000,
  );
  const keyDate =
    (device.openParams && device.openParams.keyDate) || defaultKeyDate;
  const startDate = (device.openParams && device.openParams.startDate) || now;
  const periodNo =
    device.openParams && device.openParams.periodNo !== undefined
      ? device.openParams.periodNo
      : 0;

  try {
    await client.addKey({
      serial: deviceSerial,
      password: devicePassword,
      keyType: 1,
      keyId,
      keyCount: 1,
      startDate,
      keyDate,
      periodNo,
    });
  } catch (err) {
    console.error(
      `[door-permissions] data.key.add failed for device ${deviceSerial}:`,
      err.message,
    );
  }

  try {
    await client.mqttKeyUpdate({
      serial: deviceSerial,
      password: devicePassword,
      userId,
    });
  } catch (err) {
    console.error(
      `[door-permissions] mqtt.key.update failed for device ${deviceSerial}:`,
      err.message,
    );
  }
}

/**
 * 为一条已通过认证的记录分配门禁权限
 * 流程：data.user.add → 查适用设备 → data.key.add + mqtt.key.update → 回写字段
 *
 * @param {object} cert      - certification_applications 记录（必须含 _id, building, unit, communityId）
 * @param {string} communityId
 */
async function grantDoorAccess(cert, communityId) {
  const platform = process.env.FONDCARD_OPEN_PLATFORM;
  if (!platform) {
    throw new Error("fondcard_platform_not_configured");
  }

  const client = new FondcardClient();

  // 1. 创建 Fondcard 用户
  const userRes = await client.addUser({ platform });
  const userData = userRes && userRes.data;
  const userId = userData && userData.id;
  const fondcardSerial = userData && userData.serial;
  const fondcardUserPassword = userData && userData.password;

  if (!userId || !fondcardSerial || !fondcardUserPassword) {
    throw new Error("fondcard_user_add_failed_incomplete_response");
  }

  const keyId = toHex8(userId);
  if (!keyId) throw new Error("fondcard_keyhex_invalid");

  // 2. 查询该小区启用的门禁设备
  const certUnitKey = buildUnitKey(cert.building, cert.unit);

  const devicesRes = await db
    .collection("door_devices")
    .where({ communityId, enabled: true })
    .get();
  const allDevices = devicesRes.data || [];

  const applicableDevices = allDevices.filter((device) => {
    if (device.locationType === "community_gate") return true;
    if (device.locationType === "unit_gate") {
      const deviceUnitKey = buildUnitKey(device.building, device.unit);
      return !!certUnitKey && deviceUnitKey === certUnitKey;
    }
    return false;
  });

  // 3. 对每台适用设备绑定 Key
  for (const device of applicableDevices) {
    await bindKeyToDevice(client, device, keyId, userId);
  }

  // 4. 回写 Fondcard 凭证到认证记录
  await db
    .collection("certification_applications")
    .doc(cert._id)
    .update({
      fondcardId: String(userId),
      fondcardSerial,
      fondcardUserPassword,
      doorAccessEnabled: true,
      updatedAt: new Date().toISOString(),
    });
}

/**
 * 吊销一条认证记录的全部门禁权限
 * 调用 data.user.delete 删除 Fondcard 用户（同时清除所有设备的 Key）
 * 失败只记录日志，不抛出异常（不阻断主流程）
 *
 * @param {object} cert - certification_applications 记录
 */
async function revokeDoorAccess(cert) {
  if (!cert || (!cert.fondcardSerial && !cert.fondcardId)) {
    return; // 从未分配过权限，跳过
  }

  if (cert.fondcardSerial && cert.fondcardUserPassword) {
    const client = new FondcardClient();
    try {
      await client.call("data.user.delete", {
        serial: cert.fondcardSerial,
        password: cert.fondcardUserPassword,
      });
    } catch (err) {
      console.error(
        `[door-permissions] data.user.delete failed for cert ${cert._id}:`,
        err.message,
      );
    }
  }

  // 清空 Fondcard 字段，标记为已吊销
  try {
    await db.collection("certification_applications").doc(cert._id).update({
      fondcardId: "",
      fondcardSerial: "",
      fondcardUserPassword: "",
      doorAccessEnabled: false,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(
      `[door-permissions] failed to clear fondcard fields for cert ${cert._id}:`,
      err.message,
    );
  }
}

/**
 * 为已有门禁权限的认证记录添加新设备的 Key（设备新增时调用）
 * @param {object} cert   - certification_applications 记录（需含 fondcardId）
 * @param {object} device - 新增的 door_devices 记录
 */
async function addKeyToNewDevice(cert, device) {
  if (!cert.fondcardId || !cert.doorAccessEnabled) return;

  const keyId = toHex8(Number(cert.fondcardId));
  if (!keyId) return;

  const client = new FondcardClient();
  await bindKeyToDevice(client, device, keyId, cert.fondcardId);
}

module.exports = { grantDoorAccess, revokeDoorAccess, addKeyToNewDevice };
