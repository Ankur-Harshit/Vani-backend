const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  commenterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "post",
    required: true,
    index: true,
  },
  text: {
    type: String,
    required: true,
    trim: true,
    maxLength: 500,
  },
  parentCommentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "comment",
    default: null,
    index: true,
    },
    like: {
      type: Number,
      default: 0,
    },
  isDeleted: {
    type: Boolean,
    default: false,
  },
}, {
    timestamps: true,
})

commentSchema.index({ postId: 1, createdAt: -1 });
commentSchema.index({ postId: 1, createdAt: -1 });


module.exports = mongoose.model("Comment", commentSchema);