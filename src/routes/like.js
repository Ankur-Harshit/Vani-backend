const express = require('express');
const connectDB = require("../config/database");
const app = express();
const User = require("../models/user");
const {userAuth} = require("../middlewares/auth");
const likeRouter = express.Router();
const ConnectionRequest = require("../models/connectionRequest");
const Follow = require("../models/follow");
const Like = require("../models/Like");
const Post = require("../models/post");
const notificationQueue = require("../queue/notificationQueue");
const mongoose = require("mongoose");

likeRouter.post("/like/:postId", userAuth, async (req, res) => { 
    try {
        const userId = req.user._id;
        const postId = req.params.postId;
        if (!mongoose.Types.ObjectId.isValid(postId)) {
          return res.status(400).json({ message: "Invalid post ID." });
        }
        const post = await Post.findById(postId);
        if (!post) {
          return res.status(404).json({ message: "Post not found." });
        }
        const alreadyLiked = await Like.findOne({
            userId,
            postId,
        });
        if (alreadyLiked) {
            await Like.findByIdAndDelete(alreadyLiked._id);
            await Post.findByIdAndUpdate(postId, {
                $inc: { likesCount: -1 },
            });
            return res.json({ message: "Post unliked." });
        }
        await Like.create({
            userId,
            postId,
        });
        await Post.findByIdAndUpdate(postId, {
            $inc: { likesCount: 1 },
        });

        await notificationQueue.add("NEW_LIKE", {
            actorId: userId,
            userId: post.authorId,
            postId: postId,
        }, {
            attempts: 3,
            backoff: 5000,
        });
        
        res.json({ message: "Post liked." });
    }
    catch (err) {
        res.status(500).json({ message: "Server error." });
    }
});

likeRouter.get("/like/byme", userAuth, async (req, res) => { 
    try {
        const userId = req.user._id;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;
        const LikedPosts = await Like.find({
            userId,
        }).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("postId");
        res.json({ likedPosts: LikedPosts });

    }
    catch (err) {
        res.status(500).json({ message: "Server error." });
    }
});


module.exports = likeRouter;