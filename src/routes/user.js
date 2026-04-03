const express = require('express');
const userRouter = express.Router();
const {userAuth} = require("../middlewares/auth");
const ConnectionRequestModel = require("../models/connectionRequest");
const USER_SAFE_DATA = "firstName lastName username photoUrl gender about followersCount followingCount isPrivate";
const User = require("../models/user");
const Follow = require("../models/follow");
const getProfileAccess = require("../utils/getProfileAccess");
const { default: mongoose } = require('mongoose');
const redis = require("../config/redis");
const Post = require("../models/post");
const Notification = require("../models/notification");

userRouter.get("/user/requests/recieved", userAuth, async(req, res)=>{
    try{
        const loggedInUser = req.user;
        const connectionRequests = await ConnectionRequestModel.find({
            toUserId: loggedInUser._id,
            status: "pending",
        }).populate(
            "fromUserId", 
            "firstName lastName photoUrl age gender about skills"
        );
        res.json({
            message:"Data Fetched Successfully",
            data: connectionRequests,
        });
    }
    catch(err){
        res.status(404).send({message:"Error: "+ err.message});
    }
});

userRouter.get("/user/:userId/followers", userAuth, async (req, res) => { 
    try {
      const loggedInUser = req.user;
      const userId = req.params.userId;
      const { cursor, limit = 10 } = req.query;
      const isAuthorized =
        loggedInUser._id.toString() === userId ||
        (await Follow.exists({
          followerId: loggedInUser._id,
          followingId: userId,
        })) ||
        (await User.findById(userId).isPrivate) === "false";
      if (!isAuthorized) {
        return res
          .status(403)
          .json({ message: "Follow to see the followers." });
      }
      const query = {
        followingId: userId,
      };
      // cursor condition
      if (cursor) {
        query._id = { $lt: cursor };
      }
        const followers = await Follow.find(query).sort({ _id: -1 }).limit(parseInt(limit)).populate("followerId", USER_SAFE_DATA);
        const nextCursor = followers.length > 0 ? followers[followers.length - 1]._id : null;
        res.json({
            message: "Followers fetched successfully",
            data: followers,
            nextCursor,
        });
    }
    catch (err) {
        res.status(404).send({message:"Error: "+ err.message});
    }
});

userRouter.get("/user/:userId/following", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;
    const userId = req.params.userId;
    const { cursor, limit = 10 } = req.query;
    const isAuthorized =
      loggedInUser._id.toString() === userId ||
      (await Follow.exists({
        followerId: loggedInUser._id,
        followingId: userId,
      })) ||
      (await User.findById(userId).isPrivate) === "false";
    if (!isAuthorized) {
      return res.status(403).json({ message: "Follow to see the followers." });
    }
    const query = {
      followerId: userId,
    };
    // cursor condition
    if (cursor) {
      query._id = { $lt: cursor };
    }
    const following = await Follow.find(query)
      .sort({ _id: -1 })
      .limit(parseInt(limit))
      .populate("followingId", USER_SAFE_DATA);
    const nextCursor =
      following.length > 0 ? following[following.length - 1]._id : null;
    res.json({
      message: "Following fetched successfully",
      data: following,
      nextCursor,
    });
  } catch (err) {
    res.status(404).send({ message: "Error: " + err.message });
  }
});

userRouter.get("/user/profile/:userId", userAuth, async (req, res) => {
  try {
    const viewerId = req.user._id;
    const profileUserId = req.params.userId;
    if(!mongoose.Types.ObjectId.isValid(profileUserId)){
        throw new Error("Invalid User ID");
    }
    const profileUser = await User.findById(profileUserId).select(USER_SAFE_DATA);
    if (!profileUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const isOwnProfile = viewerId.toString() === profileUserId.toString();
    let isFollowing = false;
    let followStatus = "not_following";

    if (!isOwnProfile) {
      const follow = await Follow.findOne({
        followerId: viewerId,
        followingId: profileUserId,
      });
      isFollowing = !!follow;
      if (follow) {
        followStatus = "following";
      }
    }
    const isPrivate = profileUser.isPrivate;
    if (isPrivate) {
      const pendingRequest = await ConnectionRequestModel.findOne({
        fromUserId: viewerId,
        toUserId: profileUserId,
        status: "pending",
      });
      if (pendingRequest) {
        followStatus = "pending";
      }
    }
    const canViewPosts = !isPrivate || isOwnProfile || isFollowing;
    return res.status(200).json({
      profileUser,
      isOwnProfile,
      isFollowing,
      followStatus,
      canViewPosts,
    });
  }
  catch (err) {
    res.status(404).send({ message: "Error: " + err.message });
  }
});

userRouter.get("/user/story/:userId", userAuth, async (req, res) => {
  try {
    const viewerId = req.user._id;
    const profileUserId = req.params.userId;
    const result = await getProfileAccess(viewerId, profileUserId);
    const canViewProfile = result?.data?.canViewProfile;
    if (!canViewProfile) {
      throw new Error("You cannot view the story of this user");
    }
    const stories = await Post.find({
      authorId: profileUserId,
      type: "STORY",
      isDeleted: false,
    });
    res.json({
      message: "Stories fetched successfully",
      data: stories,
    });
  }
  catch (err) {
    res.status(404).send({ message: "Error: " + err.message });
  }
});

userRouter.get("/user/notifications", userAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { cursor, limit = 10 } = req.query;
    let query = { userId };
    if (cursor) {
      query._id = { $lt: cursor };
    }
    const notifications = await Notification.find(query)
      .sort({ _id: -1 })
      .limit(Number(limit) + 1)
      .populate({
        path: "actorId",
        select: "firstName lastName username photoUrl",
      })
      .populate({ path: "postId", select: "mediaUrls text" });
    
    if (!cursor) {
      await Notification.updateMany(
        { userId, isRead: false },
        {isRead: true},
      )
      redis.set(`notif_count:${userId}`, 0);
    }
    let nextCursor = null;
    let hasMore = false;
    if(notifications.length > limit){
      hasMore = true;
      nextCursor = notifications[limit-1]._id;
      notifications.pop();
    }
    res.json({
      message: "Notifications fetched successfully",
      data: notifications,
      nextCursor,
      hasMore,
    });
  }
  catch (err) {
    res.status(404).send({ message: "Error: " + err.message });
  }
});

userRouter.get("/user/notifications/count", userAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    let count = await redis.get(`notif_count:${userId}`);
    if (count === null) {
      // fallback to DB
      count = await Notification.countDocuments({
        userId,
        isRead: false,
      });
      await redis.set(`notif_count:${userId}`, count);
    }
    res.json({ count: Number(count) });
  }
  catch (err) {
    res.status(404).send({ message: "Error: " + err.message });
  }
});

userRouter.get("/user/explore/profiles/:searchText", userAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { cursor, limit = 20 } = req.query;
    const searchText = req.params.searchText;
    const query = {
      _id: { $ne: userId },
      $or: [
        { firstName: { $regex: searchText, $options: "i" } },
        { lastName: { $regex: searchText, $options: "i" } },
        { username: { $regex: searchText, $options: "i" } },
      ],
    };
    if (cursor) {
      query._id = {
        $ne: userId,
        $lt: cursor,
      };
    }
    const profiles = await User.find(query).sort({_id:-1}).limit(Number(limit) + 1);
    let hasMore = false;
    let nextCursor = null;
    if (profiles.length > limit) {
      hasMore = true;
      nextCursor = profiles[limit - 1]._id;
      profiles.pop();
    }
    res.json({
      message: "Profiles fetched successfully",
      data: profiles,
      nextCursor,
      hasMore,
    });
  }
  catch (err) {
    res.status(404).send({ message: "Error: " + err.message });
  }
});

module.exports = userRouter;