/**
 * 格式化房号为4位数
 * @param {string|number} room - 房号
 * @returns {string} 格式化后的房号
 */
function formatRoom(room) {
  if (!room && room !== 0) return "";

  const roomStr = String(room);
  // 如果已经是4位或更长，直接返回
  if (roomStr.length >= 4) return roomStr;

  // 补0到4位
  return roomStr.padStart(4, "0");
}

module.exports = {
  formatRoom,
};
