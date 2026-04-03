const mongoose = require("mongoose");
const User = require("../models/user");
const Follow = require("../models/follow");

const getProfileAccess = async (viewerId, profileUserId) => {
  if (!mongoose.Types.ObjectId.isValid(profileUserId)) {
    throw new Error("Invalid User ID");
  }

  const profileUser = await User.findById(profileUserId);

  if (!profileUser) {
    return {
      status: 404,
      error: "User not found",
    };
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

  const canViewProfile = !isPrivate || isOwnProfile || isFollowing;

  return {
    status: 200,
    data: {
      profileUser,
      isOwnProfile,
      isFollowing,
      isPrivate,
      canViewProfile,
    },
  };
};

module.exports = getProfileAccess;