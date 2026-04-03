const express = require("express");
const User = require("../models/user");
const { userAuth } = require("../middlewares/auth");
const { upload } = require("../middlewares/upload");
const Post = require("../models/post");
const mongoose = require("mongoose");
const postRouter = express.Router();
const Follow = require("../models/follow");
const Like = require("../models/Like");
const USER_SAFE_DATA ="firstName lastName username photoUrl gender about followersCount followingCount isPrivate";

const normalizeMediaUrls = (mediaInput) => {
    if (!mediaInput) {
        return [];
    }

    if (Array.isArray(mediaInput)) {
        return mediaInput.filter(Boolean);
    }

    if (typeof mediaInput === "string") {
        const trimmedInput = mediaInput.trim();
        if (!trimmedInput) {
            return [];
        }

        try {
            const parsed = JSON.parse(trimmedInput);
            if (Array.isArray(parsed)) {
                return parsed.filter(Boolean);
            }
        }
        catch (err) {
            // Treat non-JSON strings as a single URL or comma-separated URLs.
        }

        return trimmedInput
            .split(",")
            .map((url) => url.trim())
            .filter(Boolean);
    }

    return [];
};

const getUploadedMediaUrls = (files) => {
    if (!files) {
        return [];
    }

    if (Array.isArray(files)) {
        return files.map((file) => file.path).filter(Boolean);
    }

    return Object.values(files)
        .flat()
        .map((file) => file.path)
        .filter(Boolean);
};

postRouter.post(
    "/post/create",
    userAuth,
    upload.fields([
        { name: "media", maxCount: 10 },
        { name: "mediaUrls", maxCount: 10 },
    ]),
    async (req, res) => {
    try {
        const user = req.user;
        const { text, type, visibility, originalPostId } = req.body;
        const bodyMediaUrls = normalizeMediaUrls(req.body.mediaUrls);
        const uploadedMediaUrls = getUploadedMediaUrls(req.files);
        const mediaUrls = [...bodyMediaUrls, ...uploadedMediaUrls];

        if (!text?.trim() && mediaUrls.length === 0) {
            throw new Error("Please enter text or upload media");
        }
        const expiresAt = type === "STORY" ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;
        // extract hashtags from the text
        const hashtags = [];
        if (text) {
            const matches = text.match(/#\w+/g);
            if (matches) {
                matches.forEach((tag) => {
                    hashtags.push(tag.substring(1).toLowerCase());
                });
            }
        }
        const post = new Post({
            authorId: user._id,
            text,
            mediaUrls,
            hashtags,
            type,
            visibility,
            originalPostId,
            expiresAt,
        });
        
        const postData = await post.save();
        
      if (type == "POST") {
          await User.findByIdAndUpdate(user._id, {
            $inc: { postsCount: 1 },
          });
        }
        
        res.status(201).json({
            message: "Post created successfully",
            data: postData,
        });
    }
    catch (err) {
        res.status(400).send(err.message);
    }
});

postRouter.get("/post/:id", userAuth, async (req, res) => {
    // implement the auth logic completely //
    try {
      const postId = req.params.id;
      const userId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(postId)) {
        throw new Error("Invalid Post ID");
      }

      const post = await Post.findOne({
        _id: postId,
        isDeleted: false,
      }).populate("authorId");

      if (!post) {
        throw new Error("Post not found");
      }

      // ✅ check like
      const isLiked = await Like.exists({
        userId: userId,
        postId: postId,
      });

      // ✅ convert mongoose doc to object and inject field
      const postObj = post.toObject();
      postObj.isLiked = !!isLiked;

      res.status(200).send({
        post: postObj,
      });
    } catch (err) {
      res.status(400).send(err.message);
    }
})

postRouter.delete("/post/delete/:id", userAuth, async (req, res) => {
    try {
        const user = req.user;
        const postId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(postId)) {
          throw new Error("Invalid Post ID");
        }
        const post = await Post.findOne({ _id: postId, authorId: user._id, isDeleted: false });
        if (!post) {
            throw new Error("Failed to delete the post");
        }
        post.isDeleted = true;
        await post.save();
        res.status(200).send("Post deleted successfully");
    }
    catch (err) {
        res.status(400).send(err.message);
    }
});

postRouter.get("/post/user/:userId", userAuth, async (req, res) => { 
    try {
      const viewerId = req.user._id;
      const profileUserId = req.params.userId;
      const { cursor, limit = 5 } = req.query;

      if (!mongoose.Types.ObjectId.isValid(profileUserId)) {
        throw new Error("Invalid User ID");
      }
      const profileUser =
        await User.findById(profileUserId).select(USER_SAFE_DATA);
      if (!profileUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const isOwnProfile = viewerId.toString() === profileUserId.toString();
      let isFollowing = false;

      if (!isOwnProfile) {
        const follow = await Follow.findOne({
          followerId: viewerId,
          followingId: profileUserId,
        });

        isFollowing = !!follow;
      }
      const isPrivate = profileUser.isPrivate;
      const canViewPosts = !isPrivate || isOwnProfile || isFollowing;
      if (!canViewPosts) {
        return res.status(403).json({
          message: "This account is private",
        });
      }
      // fetching the posts of the user
      const query = {
        authorId: profileUserId,
        isDeleted: false,
        type: { $nin: ["STORY", "COMMENT"] },
      };
      if (cursor) {
        query._id = { $lt: cursor };
      }
      const posts = await Post.find(query)
        .sort({ _id: -1 })
        .limit(Number(limit) + 1).populate("authorId");
      let hasMore = false;
      let nextCursor = null;
      if (posts.length > limit) {
        hasMore = true;
        posts.pop();
        nextCursor = posts[limit - 1]._id;
        // poping because we are sending limit + 1 posts to check if there are more posts available or not. If we send only limit number of posts then we won't be able to determine if there are more posts available after the current batch or not.
      }
      // 🔥 Step 1: Collect postIds
      const postIds = posts.map((post) => post._id);

      // 🔥 Step 2: Fetch likes of current user for these posts
      const likes = await Like.find({
        userId: req.user._id,
        postId: { $in: postIds },
      }).select("postId");

      // 🔥 Step 3: Convert to Set for O(1) lookup
      const likedPostIds = new Set(likes.map((like) => like.postId.toString()));

      // 🔥 Step 4: Attach isLiked
      const resultPosts = posts.map((post) => {
        const postObj = post.toObject(); // important
        postObj.isLiked = likedPostIds.has(post._id.toString());
        return postObj;
      });
      res.status(200).json({
        message: "Posts fetched successfully",
        data: resultPosts,
        hasMore,
        nextCursor,
      });
    }
    catch (err) {
        res.status(400).send(err.message);
    }
});

module.exports = postRouter;
