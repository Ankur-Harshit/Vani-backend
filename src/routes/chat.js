const express = require('express');
const { userAuth } = require('../middlewares/auth');
const Chat = require('../models/chat');
const user = require('../models/user');
const chatRouter = express.Router();

chatRouter.get("/chat/:targetUserId", userAuth, async (req, res)=>{
    const userId = req.user._id;
    const targetUserId = req.params.targetUserId;
    try{
        let chat = await Chat.findOne({
            participants: {$all:[userId, targetUserId]},
        }).populate({
            path: "messages.senderId",
            select: "firstName lastName",
        });
        if(!chat){
            chat = new Chat({
                participants: [userId, targetUserId],
                messages: [],
            })
            await chat.save();
        }
        res.json(chat);
    }
    catch(err){
        console.log(err);
    }
});

chatRouter.get("/chat/photo/:targetUserId", userAuth, async(req, res)=>{
    const targetUserId = req.params.targetUserId;
    try{
        const targetUser = await user.findOne({
            _id: targetUserId,
        });
        res.json({data: targetUser});
    }
    catch(err){
        console.log(err);
    }
});

module.exports = chatRouter;