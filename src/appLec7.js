// trying to make the signup dynamic by sending data from the server //
const dotenv = require("dotenv");
dotenv.config();
const express = require('express');
const connectDB = require("./config/database");
const app = express();
const cookieParser = require('cookie-parser');
const authRouter = require('./routes/auth');
const profileRouter = require('./routes/profile');
const userRouter = require('./routes/user');
const postRouter = require("./routes/post");
const followRouter = require("./routes/follow");
const likeRouter = require("./routes/like");
const CommentRouter = require("./routes/comment");
const feedRouter = require("./routes/feed");
const cors = require('cors');
const http = require('http');
const initializeSocket = require("./utils/socket");
const chatRouter = require("./routes/chat");
require("./workers/notificationWorker");
require("./cron/storyExpiry");
// express has the middleware json to covert the incoming json to use it.
// this use will be handled for all the routes as we are not providing any specific route.
app.use(cookieParser());
app.use(express.json());
// app.use(cors({
//     origin: "http://localhost:5173",
//     credentials: true
// }));
// ✅ Correct CORS setup

const corsOptions = {
  origin: "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));


app.use("/", authRouter);
app.use("/", profileRouter);
app.use("/", userRouter);
app.use("/", chatRouter);
app.use("/", postRouter);
app.use("/", followRouter);
app.use("/", likeRouter);
app.use("/", CommentRouter);
app.use("/", feedRouter);

const server = http.createServer(app);
initializeSocket(server);

connectDB().then(()=>{
    console.log("Connection Established Done");
    server.listen(3000, ()=>{
        console.log("Server is sucessfully listening on port 3000...");
    })
}).catch((err)=>{
    console.error("Cannot Connect due to an Error + " + err);
});
