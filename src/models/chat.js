const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.ObjectId,
        required: true,
        ref: "user",
    },
    text: {
        type: String,
    },
    time:{
        type: String,
    }
});


const chatSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.ObjectId,
        ref: "User",
        required: true,
    },
    ],
    messages: [messageSchema],
});

module.exports = mongoose.model("Chat", chatSchema);