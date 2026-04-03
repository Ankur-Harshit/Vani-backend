const mongoose = require("mongoose");

const followSchema = new mongoose.Schema({
    followerId: {
        type: mongoose.Schema.ObjectId,
        ref: "user",
        required: true,
        index: true,
    },
    followingId: {
        type: mongoose.Schema.ObjectId,
        ref: "user",
        required: true,
        index: true,
    },
},
    {
        timestamps: true,
    },
);

// Prevent duplicate follow
// index on pairs kind of thing
// A->B, A->C, A->Z
// stored in sorted way, which makes query fast
followSchema.index(
  { followerId: 1, followingId: 1 },
  { unique: true }
);

// Fast reverse lookup
followSchema.index(
  { followingId: 1, followerId: 1 }
);

followSchema.pre("save", function (next) {
  if (this.followerId.equals(this.followingId)) {
    return next(new Error("User cannot follow themselves"));
  }
  next();
});

module.exports = mongoose.model("Follow", followSchema);