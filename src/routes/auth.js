const express = require('express');
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const {validateSignUpData} = require("../utils/validation");
const validator = require("validator");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const authRouter = express.Router();

// authRouter.post is same as app.post //

authRouter.post("/signup", async(req, res)=>{
    // console.log(req.body); // we cannot directly use req, so use express json middleware

    //1. Validate the Data
    //2. Encrypt the Password
    //3. ADD the user into the data base

    try{
        validateSignUpData(req);
        const {firstName, lastName, emailId, password} = req.body;
        //encrypt the passsword//
        const passswordHash = await bcrypt.hash(password, 10);
        //const user = new User(req.body); bad way of creating user data //
        const user = new User({
            firstName,
            lastName,
            emailId,
            password: passswordHash,
        });
        await user.save();
        res.send("User Added");
    }catch(error){
        res.status(400).send(error.message);
    }
})

authRouter.post("/login", async(req, res)=>{

    try{
        const {emailId, password} = req.body;
        if(emailId !== emailId.toLowerCase()){
            throw new Error("Email should be in lowercase only.");
        }
        if(!validator.isEmail(emailId)){
            throw new Error("Please Enter a valid Email");
        }
        const user = await User.findOne({emailId : emailId});
        if(!user){
            throw new Error("Invalid Credentials");
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if(isPasswordValid){
            const token = await jwt.sign({_id: user._id}, "DEV@Tinder$790", 
                {expiresIn: "1d"}
            );
            res.cookie("token", token);
            res.send(user);
        }
        else{
            throw new Error("Invalid credentials");
        }
    }
    catch(error){
        res.status(400).send(error.message);
    }
})

authRouter.post("/logout", async(req, res)=>{
    // Just removing the cookies //
    res.cookie("token", null, {
        expires : new Date(Date.now()),
    });
    res.send("Logout Successful");
})
module.exports = authRouter;
