cache = require('../common/cache')
eventproxy = require('eventproxy')
wechat = require('wechat')
gtore = require('glob-to-regexp')
_ = require('lodash')
mongoose = require('mongoose')
UserModel = mongoose.model('User')
UserProxy = require('../proxy').User
wxmsgProxy = require('../proxy/wxmsg')
yaml = require('js-yaml')
toMarkdown = require('to-markdown').toMarkdown
request = require('request')
sanitizeHtml = require('sanitize-html')
chalk = require('chalk')
Topic = require('../proxy').Topic
moment = require('moment')
config = require('../config')
slice = require('./tools').slice
host = 'http://yun.icerdesign.com/'

exports.interface = wechat(config.weixin, (req, res, next) ->
  proxy = new eventproxy
  proxy.fail (err) ->
    console.log err
    #res.reply('fail');
    return
  cache.get 'auto_reply_topics', proxy.done((auto_reply_topics) ->
    if auto_reply_topics
      proxy.emit 'auto_reply_topics', auto_reply_topics
    else
      Topic.getTopicsByQuery { tab: 'reply' }, { sort: '-create_at' }, proxy.done('auto_reply_topics', (auto_reply_topics) ->
        cache.set 'auto_reply_topics', auto_reply_topics, 1000 * 6 * 1
        auto_reply_topics
      )
    return
  )

  getTopic = (topics, msg, reply) ->
    i = 0
    l = topics.length
    while i < l
      topic = topics[i]
      re = gtore(topic.title, extended: true)
      if re.test(msg)
        slices = slice(topic.content)
        # console.log(slices)
        options = yaml.safeLoad(slices[0].content) or {}
        # console.log options
        if options.type == 'text'
          reply slices[1].content
        else if options.type == 'weixin'
          console.log options.articles
          reply _.map(options.articles, (a) ->
            {
              title: a.title
              description: a.description
              picurl: a.pic
              url: a.url
            }
          )
        else
          picurl = undefined
          if options.picurl != undefined
            picurl = host + picurl
          reply [ {
            title: topic.title
            description: slices[1].content.substr(0, 20)
            picurl: picurl
            url: host + 'topic/' + topic._id
          } ]
        return true
      i++
    false

  saveArticle = (user, url, title) ->
    request { uri: url }, (error, response, body) ->
      cleaned = sanitizeHtml(body,
        allowedTags: [ 'img', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol', 'nl', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre' ]
        allowedAttributes: {
          a: [ 'href', 'name', 'target' ]
          img: [ 'src', 'data-*' ]
        },
        # Lots of these won't come up by default because we don't allow them
        selfClosing: [ 'img', 'br', 'hr', 'area', 'base', 'basefont', 'input', 'link', 'meta' ]
        # URL schemes we permit
        allowedSchemes: [ 'http', 'https', 'ftp', 'mailto' ]
        exclusiveFilter: (frame) ->
          frame.tag == 'a' and !frame.attribs.src
        )
      # console.log(chalk.blue(body));
      title = title or 'no title'
      # console.log(chalk.magenta(user));
      Topic.newAndSave title, toMarkdown(cleaned), 'draft', user._id, (err, topic) ->
        if err
          return next(err)
        return
      return
    return

  UserProxy.getUserByWeixinId req.weixin.FromUserName, proxy.done('user')
  proxy.all 'auto_reply_topics', 'user', (auto_reply_topics, user) ->
    wxmsg = req.weixin
    timestr = moment(new Date(wxmsg.CreateTime * 1000)).format('YY-MM-DD HH:mm:ss')

    replyfn = (msg) ->
      console.log "reply"
      if !msg
        if !getTopic(auto_reply_topics, 'special:noreply', res.reply)
          console.log 'no reply'
          # res.reply('no reply');
        console.log chalk.magenta.bgWhite('Replied'), chalk.yellow(timestr), 'nothing special'
      else
        res.reply msg
        console.log chalk.magenta.bgWhite('Replied'), chalk.yellow(timestr), JSON.stringify(msg)
      wxmsgProxy.newAndSave wxmsg.MsgType, wxmsg.FromUserName, wxmsg.Content, wxmsg.CreateTime, msg
      return

    if user
      user = UserModel(user)
      if config.admins.hasOwnProperty(user.loginname)
        user.is_admin = true
    userstr = if user then user.name else wxmsg.FromUserName
    if wxmsg.MsgType == 'text'
      console.log chalk.cyan.bgWhite('Received'), userstr, chalk.bgCyan(wxmsg.MsgType), chalk.yellow(timestr), wxmsg.Content
      if wxmsg.Content.lastIndexOf('http://') == 0
        url = wxmsg.Content
        saveArticle url, 'no title article'
        replyfn 'ok'
      else if !getTopic(auto_reply_topics, wxmsg.Content, replyfn)
        replyfn()
    else if wxmsg.MsgType == 'event'
      console.log chalk.cyan.bgWhite('Received'), userstr, chalk.bgCyan(wxmsg.MsgType), chalk.yellow(timestr), wxmsg.Event
      if !getTopic(auto_reply_topics, 'event:' + wxmsg.Event, replyfn)
        replyfn 'nothing'
    else if wxmsg.MsgType == 'link'
      console.log chalk.cyan.bgWhite('Received'), userstr, chalk.bgCyan(wxmsg.MsgType), chalk.yellow(timestr), wxmsg.Title, wxmsg.Url
      if !user
        return replyfn('nothing')
      url = wxmsg.Url
      title = wxmsg.Title
      saveArticle user, url, title
      replyfn 'ok'
    else
      replyfn()
    return
  return
)
