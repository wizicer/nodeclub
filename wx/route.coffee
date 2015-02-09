topic = require('./topic')
wx = require('./wx')
express = require('express');
router = express.Router()


router.get '/topic/:tid', topic.ShowTopic

router.use '/', wx.interface

# router.post('/message/mark_all', middleware.auth, messageController.markAll);
module.exports = router
