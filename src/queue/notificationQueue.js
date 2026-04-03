const { Queue } = require("bullmq");
const redis = require("../config/redis");

const notificationQueue = new Queue("notificationQueue", {
    connection: redis,
})

module.exports = notificationQueue;