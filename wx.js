var cache = require('./common/cache');
var tools = require('./common/tools');
var Topic = require('./proxy').Topic;
var eventproxy = require('eventproxy');
var express = require('express');
var wechat = require('wechat');
var gtore = require('glob-to-regexp');
var _ = require('lodash');
var config = {
  token: '03ab5f15adac6a977f3b91745882adcf',
  appid: 'wxb8d5825216b6f8e0',
  EncodingAESKey: 'hE0HiwNiMU6RXxlrb2jH1O9yYHZWAAgOz7hZs4yGkEt'
};

var router = express.Router();

router.get('/topic/:tid', function (req, res, next) {
  function isUped(user, reply) {
    if (!reply.ups) {
      return false;
    }
    return reply.ups.indexOf(user._id) !== -1;
  }

  var topic_id = req.params.tid;
  if (topic_id.length !== 24) {
    return res.render('notify/notify', {
      error: '此话题不存在或已被删除。'
    });
  }
  var events = ['topic'];
  var ep = eventproxy.create(events, function (topic) {
    res.locals._layoutFile = 'wx/layout.html';
    res.render('wx/index', {
      topic: topic,
      isUped: isUped
    });
  });

  ep.fail(next);

  Topic.getFullTopic(topic_id, ep.done(function (message, topic, author, replies) {
    if (message) {
      ep.unbind();
      return res.render('notify/notify', { error: message });
    }

    topic.visit_count += 1;
    topic.save();

    // format date
    topic.friendly_create_at = tools.formatDate(topic.create_at, true);
    topic.friendly_update_at = tools.formatDate(topic.update_at, true);

    topic.author = author;

    topic.replies = replies;

    // 点赞数排名第三的回答，它的点赞数就是阈值
    topic.reply_up_threshold = (function () {
      var allUpCount = replies.map(function (reply) {
        return reply.ups && reply.ups.length || 0;
      });
      allUpCount = _.sortBy(allUpCount, Number).reverse();

      return allUpCount[2] || 0;
    })();

    ep.emit('topic', topic);
  }));
});

router.use('/', wechat(config, function(req, res, next)
{
  var proxy = new eventproxy();
  proxy.fail(function (err) {
    console.log(err);
    res.reply('fail');
  });
  cache.get('auto_reply_topics', proxy.done(function (auto_reply_topics) {
    if (auto_reply_topics) {
      proxy.emit('auto_reply_topics', auto_reply_topics);
    } else {
      Topic.getTopicsByQuery(
        { tab: 'reply' },
        { sort: '-create_at'},
        proxy.done('auto_reply_topics', function (auto_reply_topics) {
          cache.set('auto_reply_topics', auto_reply_topics, 1000 * 6 * 1);
          return auto_reply_topics;
        }));
    }
  }));
  var getTopic = function (topics, msg, reply) {
    for (var i = 0, l = topics.length; i < l; i ++) {
      var topic = topics[i];
      var re = gtore(topic.title);
      if(re.test(msg)) {
        reply(topic.content);
        return true;
      }
    }
    return false;
  }

  console.log(req.weixin);
  proxy.all('auto_reply_topics', 
    function (auto_reply_topics) {
      var wxmsg = req.weixin;
      if (wxmsg.MsgType == 'text') {
        if (!getTopic(auto_reply_topics, wxmsg.Content, res.reply)) {
          if (!getTopic(auto_reply_topics, 'special:noreply', res.reply)) {
            res.reply('no reply');
          }
        }
      } else if (wxmsg.MsgType == 'event') {
        if (!getTopic(auto_reply_topics, 'event:' + wxmsg.Event, res.reply)) {
          res.reply('nothing');
        }
      } else {
        if (!getTopic(auto_reply_topics, 'special:noreply', res.reply)) {
          res.reply('no reply');
        }
      }
    }
  );
}));
// router.post('/message/mark_all', middleware.auth, messageController.markAll);

module.exports = router;
