const express = require("express");
const feedRouter = express.Router();
const { userAuth } = require("../middlewares/auth");
const ConnectionRequestModel = require("../models/connectionRequest");
const USER_SAFE_DATA =
  "firstName lastName username photoUrl gender about followersCount followingCount isPrivate";
const User = require("../models/user");
const Follow = require("../models/follow");
const getProfileAccess = require("../utils/getProfileAccess");
const { default: mongoose } = require("mongoose");
const redis = require("../config/redis");
const Post = require("../models/post");
const Like = require("../models/Like");
const OpenAI = require("openai");


feedRouter.get("/feed", userAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { cursor, limit = 20 } = req.query;

    const cursorDate = cursor ? new Date(cursor) : null;

    // =========================
    // 1. FOLLOWING IDS
    // =========================
    const following = await Follow.find({
      followerId: userId,
    }).select("followingId");

    const followingIds = following.map((f) => f.followingId);

    const cleanFollowingIds = followingIds.filter(
      (id) => id.toString() !== userId.toString(),
    );

    // =========================
    // 2. PUBLIC USERS (REMOVE SELF)
    // =========================
    const publicUsers = await User.find({
      isPrivate: false,
    }).select("_id");

    const publicUserIds = publicUsers
      .map((u) => u._id)
      .filter((id) => id.toString() !== userId.toString());

    // =========================
    // 3. SEEN POSTS (FIXED)
    // =========================
    const seenKey = `feed:seen:${userId}`;

    const seenPostIds = (await redis.smembers(seenKey)).map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    // =========================
    // 4. BASE FILTER
    // =========================
    const baseFilter = {
      isDeleted: false,
      _id: { $nin: seenPostIds },
    };

    // =========================
    // 5. FETCH POSTS
    // =========================
    const [F, I, T, R] = await Promise.all([
      // FOLLOWING
      // returns mongoose documents with all methods and virtuals, so we can use .toObject() or virtuals on them.
      Post.find({
        ...baseFilter,
        authorId: { $in: cleanFollowingIds },
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("authorId"),

      // INTEREST (PUBLIC ONLY)
      Post.find({
        ...baseFilter,
        hashtags: { $in: req.user.interests || [] },
        authorId: { $in: publicUserIds },
      })
        .sort({ likesCount: -1 })
        .limit(5)
        .populate("authorId"),

      // TRENDING (PUBLIC ONLY)
      Post.find({
        ...baseFilter,
        authorId: { $in: publicUserIds },
      })
        .sort({ likesCount: -1, commentsCount: -1 })
        .limit(5)
        .populate("authorId"),

      // RANDOM (PUBLIC ONLY)
      // returns plain documents without mongoose methods, so we won't be able to use .toObject() or virtuals on them.
      Post.aggregate([
        {
          $match: {
            ...baseFilter,
            authorId: { $in: publicUserIds },
          },
        },
        { $sample: { size: 5 } },

        {
          $lookup: {
            from: "users", // collection name (IMPORTANT: lowercase plural)
            localField: "authorId", // field in Post
            foreignField: "_id", // field in User
            as: "authorId", // output field
          },
        },

        {
          $unwind: "$author", // convert array → object
        },
      ]),
    ]);

    // =========================
    // 6. MERGE + SCORE + SORT
    // =========================
    const used = new Set();
    const candidates = [];

    function getScore(post, source) {
      const now = Date.now();

      // ⏱ recency
      const hours = (now - new Date(post.createdAt)) / (1000 * 60 * 60);
      const recency = 1 / (hours + 1);

      // 🔥 engagement
      const engagement =
        (post.likesCount || 0) * 1 +
        (post.commentsCount || 0) * 2 +
        (post.sharesCount || 0) * 3;
      (post.type === "STORY" || 0) * 8;

      const engagementScore = Math.log(engagement + 1);

      // 🎯 source boost
      const sourceBoostMap = {
        F: 1.0,
        I: 0.8,
        T: 0.7,
        R: 0.5,
      };

      const sourceBoost = sourceBoostMap[source] || 0.5;

      // 🎯 interest boost
      const interestBoost = (req.user.interests || []).some((tag) =>
        (post.hashtags || []).includes(tag),
      )
        ? 1
        : 0;

      return (
        recency * 0.3 +
        engagementScore * 0.3 +
        sourceBoost * 0.25 +
        interestBoost * 0.15
      );
    }

    function addPosts(posts, source) {
      for (let post of posts) {
        const id = post._id.toString();
        if (used.has(id)) continue;

        used.add(id);

        candidates.push({
          post,
          score: getScore(post, source),
        });
      }
    }

    addPosts(F, "F");
    addPosts(I, "I");
    addPosts(T, "T");
    addPosts(R, "R");

    // 🔥 GLOBAL SORT
    candidates.sort((a, b) => b.score - a.score);

    const result = candidates.slice(0, Number(limit)).map((c) => c.post);
    const postIds = result.map((p) => p._id);
    const likedPostIds = await Like.find({
        userId,
        postId: { $in: postIds },
    }).select("postId");
      
      const finalResult = result.map(post => {
          const isLiked = likedPostIds.some(like => like.postId.toString() === post._id.toString());
          const postObj = post.toObject ? post.toObject() : post; // Handle both Mongoose documents and plain objects
          return {
              ...postObj,
              isLiked,
          };
      });

    // =========================
    // 7. STORE SEEN POSTS
    // =========================
    if (finalResult.length) {
      await redis.sadd(
        seenKey,
        finalResult.map((p) => p._id.toString()),
      );
      await redis.expire(seenKey, 60 * 60 * 24);
    }
    if (finalResult.length === 0) {
      await redis.del(`feed:seen:${userId}`);

      return res.json({
        success: true,
        data: [],
        nextCursor: null,
        message: "You have seen all posts",
      });
    }

    // =========================
    // 8. RESPONSE
    // =========================
    const nextCursor =
      finalResult.length > 0
        ? finalResult[finalResult.length - 1].createdAt
        : null;

    res.json({
      success: true,
      data: finalResult,
      nextCursor,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error: " + err.message,
    });
  }
});

feedRouter.get("/feed/profiles", userAuth, async (req, res) => {
    try {
        const userId = req.user._id;
        const myInterests = req.user.interests || [];
        const myFollowings = await Follow.find({ followerId: userId }).lean();
        const myFollowingIds = myFollowings.map((f) => f.followingId);
        const excludeIds = [...myFollowingIds, userId];

        const foafFollows = await Follow.find({
          followerId: { $in: myFollowingIds },
          followingId: { $nin: excludeIds },
        }).lean();

        const foafCountMap = {};
        for (const follow of foafFollows) {
          const cId = follow.followingId.toString();
          foafCountMap[cId] = (foafCountMap[cId] || 0) + 1;
        }

        // Convert string keys back to ObjectIds
        const foafCandidateIds = Object.keys(foafCountMap).map(
          (id) => new mongoose.Types.ObjectId(id),
        );

        const popularUsers = await User.find(
          { _id: { $nin: [...excludeIds, ...foafCandidateIds] } },
          {
            firstName: 1,
            lastName: 1,
            username: 1,
            photoUrl: 1,
            about: 1,
            interests: 1,
            followersCount: 1,
            isVerified: 1,
          },
        )
          .sort({ followersCount: -1 })
          .limit(20)
            .lean();
        
        const foafUsers = await User.find(
          { _id: { $in: foafCandidateIds } },
          {
            firstName: 1,
            lastName: 1,
            username: 1,
            photoUrl: 1,
            about: 1,
            interests: 1,
            followersCount: 1,
            isVerified: 1,
          },
        ).limit(20).lean();

        const scoreUser = (candidate) => {
            let score = 0;
            score += (foafCountMap[candidate._id.toString()] || 0) * 10;
            const commonInterests = (candidate.interests || []).filter((i) =>
              myInterests.includes(i),
            );
            score += commonInterests.length * 3;
            score += Math.min(Math.floor((candidate.followersCount || 0) / 10), 5);
            if (candidate.isVerified) score += 2;

            return { ...candidate, score };
        }

        const allCandidates = [...foafUsers, ...popularUsers].map(scoreUser);
        allCandidates.sort((a, b) => b.score - a.score);
        res.status(200).json({
            success: true,
            data: allCandidates,
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: "Error: " + err.message,
        });
    }
})

feedRouter.post("/feed/explain/post", userAuth, async (req, res) => {
  try {
    const { firstName, lastName, text, mediaUrl } = req.body;
    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
    let response;
    if (!mediaUrl) {
      response = await client.responses.create({
        model: "openai/gpt-oss-20b",
        input:
          "Here is a post created by " +
          firstName +
          " " +
          lastName +
          ", " +
          text +
          ", kindly explain the post in minimum 15 words and maximum 80 words.If some topics require deep explaination, then ignore the limit.If the topic includes India then be Bias towards India.",
      });
    }
    else {
      response = await client.responses.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "Here is a post created by " +
                  firstName +
                  " " +
                  lastName +
                  ", " +
                  text +
                  ", kindly explain the post in minimum 15 words and maximum 50 words.If some topics require deep explaination, then ignore the limit.If the topic includes India then be Bias towards India.",
              },
              {
                type: "input_image",
                detail: "auto",
                image_url: mediaUrl,
              },
            ],
          },
        ],
      });
    }

    res.status(200).json({
      data: response.output_text,
    });
  }
  catch (err) {
    res.status(404).json(err);
  }
})

feedRouter.post("/ask/hinge", userAuth, async (req, res) => {
  try {
    const { firstName, lastName, text, mediaUrl } = req.body;
    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
    let response;
    if (!mediaUrl) {
      response = await client.responses.create({
        model: "openai/gpt-oss-20b",
        input:
          text +
          "Instructions: Keep the response concise (max 80 words).Be clear, structured, and helpful.If the topic is complex, prioritize key insights over surface-level explanation.Avoid fluff, filler, or generic statements.If the topic includes India then be Bias towards India.",
      });
    }
    res.status(200).json({
      data: response.output_text,
    });
  }
  catch (err) {
    res.status(404).json(err);
  }
})

module.exports = feedRouter;