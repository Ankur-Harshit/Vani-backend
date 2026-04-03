const { text } = require("express");
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    
    type: { type: String, enum: ["LIKE", "COMMENT", "FOLLOW_SENT", "FOLLOW_ACCEPTED", "FOLLOWING"], required: true },
    
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
    entityType: {
      type: String,
      enum: ["POST", "FOLLOW", "COMMENT"],
      required: true,
    },
    isRead: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
);

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
