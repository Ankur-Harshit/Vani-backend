const mongoose = require("mongoose");
const { trim } = require("validator");
const postSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["POST", "TWEET", "STORY", "REPOST", "COMMENT"],
      default: "POST",
    },
    text: {
      type: String,
      maxLength: 2800,
      trim: true,
    },
    mediaUrls: {
      type: [String],
      default: [],
    },
    hashtags: {
      type: [String],
      default: [],
      index: true,
    },
    visibility: {
      type: String,
      enum: ["PUBLIC", "PRIVATE", "CLOSE"],
      default: "PUBLIC",
    },
    // for reposts
    originalPostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "post",
      default: null,
    },
    parentPostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "post",
      default: null,
    },
    rootPostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "post",
      default: null,
    },
    likesCount: {
      type: Number,
      default: 0,
    },
    commentsCount: {
      type: Number,
      default: 0,
    },
    sharesCount: {
      type: Number,
      default: 0,
    },
    // For stories (auto expire)
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Post", postSchema);