Topic = require('../proxy').Topic

exports.ShowTopic = (req, res, next) ->
  topic_id = req.params.tid

  isUped = (user, reply) ->
    if !reply.ups
      return false
    reply.ups.indexOf(user._id) != -1

  if topic_id.length != 24
    return res.render('notify/notify', error: '此话题不存在或已被删除。')
  events = [ 'topic' ]
  ep = eventproxy.create(events, (topic) ->
    res.locals._layoutFile = 'wx/layout.html'
    res.render 'wx/index',
      topic: topic
      isUped: isUped
    return
  )
  ep.fail next
  Topic.getFullTopic topic_id, ep.done((message, topic, author, replies) ->
    if message
      ep.unbind()
      return res.render('notify/notify', error: message)
    topic.visit_count += 1
    topic.save()
    # format date
    topic.friendly_create_at = tools.formatDate(topic.create_at, true)
    topic.friendly_update_at = tools.formatDate(topic.update_at, true)
    topic.author = author
    topic.replies = replies
    # 点赞数排名第三的回答，它的点赞数就是阈值
    topic.reply_up_threshold = do ->
      allUpCount = replies.map((reply) ->
        reply.ups and reply.ups.length or 0
      )
      allUpCount = _.sortBy(allUpCount, Number).reverse()
      allUpCount[2] or 0
    ep.emit 'topic', topic
    return
  )
  return
