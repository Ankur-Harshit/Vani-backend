const express = require('express');
const connectDB = require("../config/database");
const app = express();
const User = require("../models/user");
const {userAuth} = require("../middlewares/auth");
const followRouter = express.Router();
const ConnectionRequest = require("../models/connectionRequest");
const Follow = require("../models/follow");
const notificationQueue = require("../queue/notificationQueue");
const mongoose = require("mongoose");

followRouter.post("/follow/:toUserId", userAuth, async (req, res) => { 
    try {
        const fromUserId = req.user._id;
        const toUserId = req.params.toUserId;

        if (!mongoose.Types.ObjectId.isValid(toUserId)) {
          return res.status(400).json({ message: "Invalid user ID." });
        }
        const targetUser = await User.findById(toUserId).select("isPrivate firstName");
        if (!targetUser) {
          return res.status(404).json({ message: "User not found." });
        }
        const alreadyFollowing = await Follow.findOne({
          followerId: fromUserId,
          followingId: toUserId,
        });
        if (alreadyFollowing) {
            return res.status(409).json({
                message: `You already follow @${targetUser.firstName}.`
            });
        }
        const existingRequest = await ConnectionRequest.findOne({
          fromUserId,
          toUserId: toUserId,
          status: "pending",
        });
        if (existingRequest) {
          return res
            .status(409)
            .json({ message: "Follow request already sent." });
      }
        const rejectedRequest = await ConnectionRequest.findOne({
          fromUserId,
          toUserId: toUserId,
          status: "rejected",
        });
        if (rejectedRequest) {
          await ConnectionRequest.findByIdAndDelete(rejectedRequest._id);
        }
        if (!targetUser.isPrivate) {
          const follow = new Follow({
            followerId: fromUserId,
            followingId: toUserId,
          });
            await User.findByIdAndUpdate(fromUserId, {
                $inc: { followingCount: 1 },
            });
            await User.findByIdAndUpdate(toUserId, {
                $inc: { followersCount: 1 },
            });
          await follow.save();

          await notificationQueue.add(
            "FOLLOWING",
            {
              actorId: fromUserId,
              userId: toUserId,
            },
            {
              attempts: 3,
              backoff: 5000,
            },
          );

          return res.status(200).json({
            message: `You are now following @${targetUser.firstName}.`,
          });
        }
        const connectionRequest = new ConnectionRequest({
          fromUserId,
          toUserId: toUserId,
          status: "pending",
        });
        await connectionRequest.save();
        await notificationQueue.add(
          "FOLLOW_SENT",
          {
            actorId: fromUserId,
            userId: toUserId,
          },
          {
            attempts: 3,
            backoff: 5000,
          },
        );

        return res.status(200).json({
          message: `Follow request sent to @${targetUser.firstName}.`,
        });
    }
    catch (err) {
        console.error("sendFollowRequest error:", err);
        res.status(500).json({ message: "Internal server error.", error: err.message });
    }
});

followRouter.post("/follow/review/:status/:requestId", userAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, requestId } = req.params;
    const allowedStatus = ["accepted", "rejected"];
    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }
    const connectionRequest = await ConnectionRequest.findById(requestId);
    if (!connectionRequest) {
      return res.status(404).json({ message: "Connection request not found." });
    }
    if (connectionRequest.toUserId.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({
          message: "You are not authorized to review this follow request.",
        });
    }
    if (connectionRequest.status !== "pending") {
      return res
        .status(400)
        .json({ message: "This follow request has already been reviewed." });
    }
    if (status === "rejected") {
      connectionRequest.status = "rejected";
      await connectionRequest.save();
      return res.status(200).json({ message: "Follow request rejected." });
    }
    // accepted //
    // Use a session so both writes succeed or fail together
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      connectionRequest.status = "accepted";
      await connectionRequest.save({ session });
      const follow = new Follow({
        followerId: connectionRequest.fromUserId,
        followingId: connectionRequest.toUserId,
      });
      await follow.save({ session });
      await User.findByIdAndUpdate(connectionRequest.fromUserId, {
        $inc: { followingCount: 1 },
      }, { session });
      await User.findByIdAndUpdate(connectionRequest.toUserId, {
        $inc: { followersCount: 1 },
      }, { session });
      await session.commitTransaction();
      session.endSession();
      await notificationQueue.add(
        "FOLLOW_ACCEPTED",
        {
          actorId: userId,
          userId: connectionRequest.fromUserId,
        },
        {
          attempts: 3,
          backoff: 5000,
        },
      );
      res.status(200).json({ message: "Follow request accepted." });
    }
    catch (txnErr) {
      await session.abortTransaction();
      session.endSession();
      console.error("Transaction error:", txnErr);
      throw txnErr; // This will be caught by the outer catch block
    }
  }
  catch (err) {
    console.error("Error in reviewFollowRequest:", err);
    res.status(500).json({ message: "Internal server error.", error: err.message });
  }
});

followRouter.post("/follow/withdraw/:toUserId", userAuth, async (req, res) => {
  try {
    const fromUserId = req.user._id;
    const toUserId = req.params.toUserId;
    if (!mongoose.Types.ObjectId.isValid(toUserId)) {
      return res.status(400).json({ message: "Invalid user ID." });
    }
    const connectionRequest = await ConnectionRequest.findOne({
      fromUserId,
      toUserId: toUserId,
      status: "pending",
    });
    if (!connectionRequest) {
      return res.status(404).json({ message: "No pending follow request found." });
    }
    await ConnectionRequest.findByIdAndDelete(connectionRequest._id);
    res.status(200).json({ message: "Follow request withdrawn." });
  }
  catch (err) {
    res.status(500).json({ message: "Internal server error.", error: err.message });
  }
});

followRouter.post("/unfollow/:toUserId", userAuth, async (req, res) => { 
  try {
    const fromUserId = req.user._id;
    const toUserId = req.params.toUserId;
    if (!mongoose.Types.ObjectId.isValid(toUserId)) {
      return res.status(400).json({ message: "Invalid user ID." });
    }
    if(fromUserId.toString() === toUserId.toString()){
      return res.status(400).json({ message: "You cannot unfollow yourself." });
    }
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const follow = await Follow.findOneAndDelete(
        {
          followerId: fromUserId,
          followingId: toUserId,
        },
        { session }
      );

      if (!follow) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(404)
          .json({ message: "You are not following this user." });
      }

      await User.findByIdAndUpdate(
        toUserId,
        { $inc: { followersCount: -1 } },
        { session }
      );
      await User.findByIdAndUpdate(
        fromUserId,
        { $inc: { followingCount: -1 } },
        { session }
      );

      await session.commitTransaction();
      session.endSession();
      return res.status(200).json({ message: "Unfollowed successfully." });
    } catch (txnErr) {
      await session.abortTransaction();
      session.endSession();
      throw txnErr;
    }
  }
  catch (err) {
    res.status(500).json({ message: "Internal server error.", error: err.message });
  }
});

module.exports = followRouter;
