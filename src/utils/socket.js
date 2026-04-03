const socket = require("socket.io");
const Chat = require("../models/chat");

const initializeSocket = (server) => {
    const io = socket(server, {
        cors: {
            origin: ["http://localhost:5173", "http://localhost:3000", "http://pullrequest.online", "https://www.pullrequest.online"], // allow both dev + prod
            methods: ["GET", "POST"],
            credentials: true,
        },
    });
    io.on("connection", (socket)=>{
        // Handle Events //
        socket.on("joinChat", ({firstName, userId, targetUserId, time})=>{
            // now we need to create roomm, every chat have a unique room
            const roomId = [userId, targetUserId].sort().join("_");
            socket.join(roomId);
        });

        socket.on("sendMessage", async ({firstName, lastName, userId, targetUserId, text, time,})=>{
            const roomId = [userId, targetUserId].sort().join("_");
            try{
                let chat = await Chat.findOne({
                    participants: { $all: [userId, targetUserId]},
                })
                if(!chat){
                    chat = new Chat({
                        participants: [userId, targetUserId],
                        messages:[],
                    });
                };
                chat.messages.push({
                    senderId: userId,
                    text: text,
                    time: time,
                });
                await chat.save();
                io.to(roomId).emit("messageRecieved", {firstName, lastName, text, userId, time,});
            }
            catch(err){
                console.log(err);
            }
        });

        socket.on("disconnect", ()=>{});
    });
};

module.exports = initializeSocket;