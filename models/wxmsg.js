var mongoose = require('mongoose');
var Schema = mongoose.Schema;

/*
 * type:
 * text
 *
 * currently only support `text`
 */

var WxMsgSchema = new Schema({
  type: { type: String },
  weixinId: { type: String},
  content: { type: String},
  create_at: { type: Date, default: Date.now },
  reply: { type: Object }
});

WxMsgSchema.index({weixinId: 1, create_at: -1});

mongoose.model('WxMsg', WxMsgSchema);
