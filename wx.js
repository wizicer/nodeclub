var cache = require('./common/cache');
var tools = require('./common/tools');
var Topic = require('./proxy').Topic;
var eventproxy = require('eventproxy');
var express = require('express');
var wechat = require('wechat');
var gtore = require('glob-to-regexp');
var _ = require('lodash');
var mongoose = require('mongoose');
var UserModel = mongoose.model('User');
var UserProxy = require('./proxy').User;
var wxmsgProxy = require('./proxy/wxmsg');
var yaml = require('js-yaml');
var toMarkdown = require('to-markdown').toMarkdown;
var request = require('request');
var sanitizeHtml = require('sanitize-html');
var chalk = require('chalk');
var moment = require('moment');
var config = require('./config');

var host = 'http://yun.icerdesign.com/';

var router = express.Router();

/**
 * Returns a chopped up document that's easy to parse.
 *
 * @param {string} The full document
 * @return {Array.<string>} A list of all slides
 */
var slice = function(document) {
  var cuts = document.split(/\n(?=\-\-)/);
  var slices = [];
  var nlIndex;

  for (var i = 0; i < cuts.length; i++) {
    /**
     * The first slide does not get the following treatment, so we just
     * add it as content.
     *
     * Otherwise, we slice off the `--` at the beginning.
     */
    if (!cuts[i].match(/^--/)) {
      slices.push({
        content: cuts[i].trim()
      });

      continue;
    } else {
      /* If we leave out options, add an empty slide at the beginning */
      if (i === 0) {
        slices.push({ content: '' });
      }

      cuts[i] = cuts[i].slice(2);
    }

    /**
     * Slices at this point will contain class names, followed by several
     * newlines
     */
    nlIndex = cuts[i].indexOf('\n');
    if (nlIndex === -1) {
      // Just to be safe...
      nlIndex = 0;
    }

    /* Push the classList and markdown content */
    slices.push({
      classList: cuts[i].slice(0, nlIndex),
      content: cuts[i].slice(nlIndex).trim()
    });
  }

  return slices;
};

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

router.use('/', wechat(config.weixin, function(req, res, next)
{
  var proxy = new eventproxy();
  proxy.fail(function (err) {
    console.log(err);
    //res.reply('fail');
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
      var re = gtore(topic.title, {extended: true});
      if(re.test(msg)) {
        var slices = slice(topic.content);
        // console.log(slices);
        options = yaml.safeLoad(slices[0].content) || {};
        if (options.type == 'text') {
          reply(slices[1].content);
        } else if (options.type == 'weixin') {
          console.log(options.articles);
          reply(_.map(options.articles, function(a) { return {title: a.title, description: a.description, picurl: a.pic, url: a.url}; }));
        } else {
          var picurl;
          if (options.picurl !== undefined) {
            picurl = host + picurl;
          }
          reply([{
            title: topic.title,
            description: slices[1].content.substr(0,20),
            picurl: picurl,
            url: host + 'topic/' + topic._id
          }]);
        }
        return true;
      }
    }
    return false;
  }

  var saveArticle = function (user, url, title) {
    request({uri: url}, function (error, response, body) {
      var cleaned = sanitizeHtml(body, {
        allowedTags: [ 'img', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol', 'nl', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre' ],
        allowedAttributes: {
          a: [ 'href', 'name', 'target' ],
          img: [ 'src', 'data-*' ]
        },
        // Lots of these won't come up by default because we don't allow them
        selfClosing: [ 'img', 'br', 'hr', 'area', 'base', 'basefont', 'input', 'link', 'meta' ],
        exclusiveFilter: function(frame) {
          return frame.tag === 'a' && !frame.attribs.src;
        },
        // URL schemes we permit
        allowedSchemes: [ 'http', 'https', 'ftp', 'mailto' ]
      });
      // console.log(chalk.blue(body));

      title = title || "no title";
      // console.log(chalk.magenta(user));
      Topic.newAndSave(title, toMarkdown(cleaned), 'draft', user._id, function (err, topic) {
        if (err) {
          return next(err);
        }
      });
    });
  }

  UserProxy.getUserByWeixinId(req.weixin.FromUserName, proxy.done('user'));

  proxy.all('auto_reply_topics', 'user', 
    function (auto_reply_topics, user) {
      var wxmsg = req.weixin;
      var timestr = moment(new Date(wxmsg.CreateTime * 1000)).format("YY-MM-DD HH:mm:ss");
      var replyfn = function (msg) {
        if (!msg) {
          if (!getTopic(auto_reply_topics, 'special:noreply', res.reply)) {
            console.log('no reply');
            // res.reply('no reply');
          }
          console.log(chalk.magenta.bgWhite("Replied"), chalk.yellow(timestr), "nothing special");
        } else {
          res.reply(msg);
          console.log(chalk.magenta.bgWhite("Replied"), chalk.yellow(timestr), JSON.stringify(msg));
        }
        wxmsgProxy.newAndSave(wxmsg.MsgType, wxmsg.FromUserName, wxmsg.Content, wxmsg.CreateTime, msg);
      }

      if (user) {
        user = UserModel(user);
        if (config.admins.hasOwnProperty(user.loginname)) {
          user.is_admin = true;
        }
      }

      var userstr = user ? user.name : wxmsg.FromUserName;
      if (wxmsg.MsgType == 'text') {
        console.log(chalk.cyan.bgWhite("Received"), userstr, chalk.bgCyan(wxmsg.MsgType), chalk.yellow(timestr), wxmsg.Content);
        if (wxmsg.Content.lastIndexOf("http://") === 0) {
          var url = wxmsg.Content;
          saveArticle(url, "no title article");
          replyfn('ok');
        } else if (!getTopic(auto_reply_topics, wxmsg.Content, replyfn)) {
          replyfn();
        }
      } else if (wxmsg.MsgType == 'event') {
        console.log(chalk.cyan.bgWhite("Received"), userstr, chalk.bgCyan(wxmsg.MsgType), chalk.yellow(timestr), wxmsg.Event);
        if (!getTopic(auto_reply_topics, 'event:' + wxmsg.Event, replyfn)) {
          replyfn('nothing');
        }
      } else if (wxmsg.MsgType == 'link') {
        console.log(chalk.cyan.bgWhite("Received"), userstr, chalk.bgCyan(wxmsg.MsgType), chalk.yellow(timestr), wxmsg.Title, wxmsg.Url);
        if (!user)
        {
          return replyfn('nothing');
        }

        var url = wxmsg.Url;
        var title = wxmsg.Title;
        saveArticle(user, url, title);
        replyfn('ok');
      } else {
        replyfn();
      }
    }
  );
}));
// router.post('/message/mark_all', middleware.auth, messageController.markAll);

module.exports = router;
