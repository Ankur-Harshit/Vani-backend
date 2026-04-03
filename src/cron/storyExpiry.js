const cron = require('node-cron');
const Post = require("../models/post");

cron.schedule("*/1 * * * *", async () => {
    try {
        console.log("Running story expiry cron job");
        const now = new Date();
        const result = await Post.updateMany(
            {
                type: "STORY",
                expiresAt: { $lt: now },
                isDeleted: false,
            },
            {
                $set: { isDeleted: true },
            },
        );
    }
    catch (err) {
        console.log("Story expiry failure", err.message);
    }
});

module.exports = cron;