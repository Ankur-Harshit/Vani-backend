const express = require('express');
const connectDB = require("../config/database");
const app = express();
const User = require("../models/user");
const {validateSignUpData} = require("../utils/validation");
const validator = require("validator");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const {userAuth} = require("../middlewares/auth");
const profileRouter = express.Router();
const {ValidateEditProfileData} = require("../utils/validation")
const {upload} = require("../middlewares/upload");
const user = require('../models/user');

profileRouter.get("/profile/view", userAuth, async(req, res)=>{
    try{
        const user = req.user;
        res.send(user);
    }
    catch(err){
        res.status(400).send("Error: "+err.message);
    }
})

profileRouter.patch("/profile/edit", userAuth, async(req, res)=>{
    try{
        if(!ValidateEditProfileData(req)){
            throw new Error("Invalid Edit Request!!!!");
        }
        const loggedInUser = req.user;
        Object.keys(req.body).forEach((key)=>(loggedInUser[key] = req.body[key]));
        await loggedInUser.save();

        res.json({
            message: `${loggedInUser.firstName}, Your profile has been updated`,
            data: loggedInUser,
        });
    }
    catch(err){
        res.status(404).send("Error : "+err.message);
    }
})

profileRouter.post("/profile/edit/photo", userAuth, upload.single("profilePic"), async(req, res)=>{
    try {
    const userId = req.user._id;  // 👈 comes from userAuth (decoded token/session)
    const imageUrl = req.file.path; // Cloudinary secure URL

    await User.findByIdAndUpdate(userId, { photoUrl: imageUrl });

    res.json({ success: true, imageUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
})

profileRouter.post("/profile/settings/privacy", userAuth, async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);
        user.isPrivate = !user.isPrivate;
        await user.save();
        res.json({
            message: `Your profile is now ${user.isPrivate ? "private" : "public"}.`,
            isPrivate: user.isPrivate,
        });
    }
    catch (err) {
        res.status(404).send({ message: "Error: " + err.message });
    }
})

profileRouter.post("/profile/settings/notifications", userAuth, async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);
        user.settings.notifications = !user.settings.notifications;
        await user.save();
        res.json({
            message: `Your notifications have been ${user.settings.notifications ? "enabled" : "disabled"}.`,
            notificationsEnabled: user.settings.notifications,
        });
    }
    catch (err) {
        res.status(404).send({ message: "Error: " + err.message });
    }
});

module.exports = profileRouter;
