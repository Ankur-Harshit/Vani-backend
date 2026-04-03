const { Worker } = require("bullmq");
const redis = require("../config/redis");
const Notification = require("../models/notification");
const Post = require("../models/post");

const worker = new Worker(
  "notificationQueue",
  async (job) => {
    const { actorId, postId, userId } = job.data;

    if (job.name === "NEW_LIKE") {

      if (userId === actorId) return;

      await Notification.create({
        userId,
        actorId,
        postId,
        type: "LIKE",
        entityId: postId,
        entityType: "POST",
      });
      console.log("✅ Notification created");
    }

    if (job.name === "FOLLOWING") {
      if (userId === actorId) return;

      await Notification.create({
        userId,
        actorId,
        type: "FOLLOWING",
        entityType: "FOLLOW",
      });
      console.log("✅FOLLOWING Notification created");
    }

    if (job.name === "FOLLOW_SENT") {
      if (userId === actorId) return;

      await Notification.create({
        userId,
        actorId,
        type: "FOLLOW_SENT",
        entityId: postId,
        entityType: "FOLLOW",
      });
      console.log("✅FOLLOW_SENT Notification created");
    }

    if (job.name === "FOLLOW_ACCEPTED") {
      if (userId === actorId) return;

      await Notification.create({
        userId,
        actorId,
        type: "FOLLOW_ACCEPTED",
        entityType: "FOLLOW",
      });
      console.log("✅FOLLOW_ACCEPTED Notification created");
    }
    await redis.incr(`notif_count:${userId}`);
  },
  {
    connection: redis,
  }
);

module.exports = worker;