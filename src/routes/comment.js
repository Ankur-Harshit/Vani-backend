const express = require("express");
const User = require("../models/user");
const { userAuth } = require("../middlewares/auth");
const Post = require("../models/post");
const getProfileAccess = require("../utils/getProfileAccess");
const mongoose = require("mongoose");
const commentRouter = express.Router();
const Follow = require("../models/follow");
const Like = require("../models/Like");
const USER_SAFE_DATA =
  "firstName lastName username photoUrl gender about followersCount followingCount isPrivate";

commentRouter.post("/comment/create/:postId", userAuth, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user._id;
        const { text, mediaUrls, type, visibility, originalPostId } = req.body;
        if (!text && !mediaUrls) {
          throw new Error("Please enter text or upload media");
        }
        const parentPost = await Post.findById(postId);
        if (!parentPost) {
            throw new Error("Post not found");
        }
        const rootPostId = parentPost.rootPostId || parentPost._id;

        const comment = await Post.create({
          authorId: userId,
          text,
          mediaUrls,
          type: "COMMENT",
          visibility,
          originalPostId,
          parentPostId: parentPost._id,
          rootPostId,
        });

        if (parentPost._id.equals(rootPostId)) {
          await Post.updateOne(
            { _id: parentPost._id },
            { $inc: { commentsCount: 1 } },
          );
        }

        else {
          await Promise.all([
            Post.updateOne(
              { _id: parentPost._id },
              { $inc: { commentsCount: 1 } },
            ),
            Post.updateOne({ _id: rootPostId }, { $inc: { commentsCount: 1 } }),
          ]);
        }

        res.status(201).json({
          message: "Comment created",
          data: comment,
        });

    }
    catch (err) {
        res.status(404).send({ message: "Error: " + err.message });
    }
});

commentRouter.get("/comment/:postId", userAuth, async (req, res) => {
    try {
        const userId = req.user._id;
        const { postId } = req.params;
        const { cursor, limit = 10 } = req.query;
        const post = await Post.findById(postId);
        if (!post) {
            throw new Error("Post not found");
        }
        const postAuthorId = post.authorId;
        const result = await getProfileAccess(userId, postAuthorId);
        const canViewProfile = result.data.canViewProfile;
        if (!canViewProfile) {
            throw new Error("This account is private. You cannot view the comments");
        }
        const query = { parentPostId: postId, isDeleted: false, type: "COMMENT" };
        if (cursor) {
            query._id = { $lt: cursor };
        }
        const comments = await Post.find(query).sort({ _id: -1 })
        .limit(Number(limit) + 1).populate("authorId");
      let isLiked = false;
        let hasMore = false;
        let nextCursor = null;
        if (comments.length > limit) {
            hasMore = true;
            comments.pop();
            nextCursor = comments[comments.length - 1]._id;
        }
        res.status(200).json({
            message: "Comments fetched successfully",
            data: comments,
            hasMore,
            nextCursor
        });
    }
    catch (err) {
        res.status(404).send({ message: "Error: " + err.message });
    }
} )

module.exports = commentRouter;