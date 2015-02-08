var EventProxy = require('eventproxy');

var models = require('../models');
var WxMsg = models.WxMsg;

/**
 * 根据消息Id获取消息
 * Callback:
 * - err, 数据库错误
 * - message, 消息对象
 * @param {String} id 消息ID
 * @param {Function} callback 回调函数
 */
exports.getMessageById = function (id, callback) {
  WxMsg.findOne({_id: id}, function (err, message) {
    if (err) {
      return callback(err);
    }
  });
};

/**
 * 根据weixinID，获取消息列表
 * Callback:
 * - err, 数据库异常
 * - messages, 消息列表
 * @param {String} weixinId 用户ID
 * @param {Function} callback 回调函数
 */
exports.getMessagesByWeixinId = function (weixinId, callback) {
  WxMsg.find({weixinId: weixinId}, null,
    {sort: '-create_at', limit: 10000}, callback);
};

exports.newAndSave = function (type, weixinId, content, create_at, reply, callback) {
  var msg = new WxMsg();
  msg.type = type;
  msg.weixinId = weixinId;
  msg.content = content;
  msg.create_at = new Date(create_at * 1000);
  msg.reply = reply;
  msg.save(callback);
};
