const mongoose = require("mongoose");

const likeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
        required: true,
        index: true,
    },
}, {
    timestamps: true,
});
// user liked which post
likeSchema.index(
    { userId: 1, postId: 1 },
    { unique: true },
);
// who liked the post
likeSchema.index(
    { postId: 1, userId: 1 },
);

module.exports = mongoose.model("Like", likeSchema);