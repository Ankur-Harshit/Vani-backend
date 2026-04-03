// always try to add proper validations in the fields of the database //
// Users should not be able to randomly enter the stuffs //
// Never Trust req.body //

const validator = require('validator');
const mongoose = require("mongoose");
const userSchema = new mongoose.Schema({
    firstName:{
        type: String,
        required : true,
        minLength : 4,
    },
    lastName:{
        type: String,
    },
    username:{
        type: String,
        unique : true,
        sparse : true, // sparse indexing indexes the field only if it is present.
        trim : true,
        lowercase : true,
        minLength : 3,
        index : true,
    },
    emailId:{
        type: String,
        required : true,
        lowercase : true,
        trim : true,
        unique : true,
        index : true,
        validate(value){
            if(!validator.isEmail(value)){
                throw new Error("Email Id is not valid");
            }
        }
    },
    password:{
        type: String,
        required : true,
    },
    age:{
        type: Number,
    },
    gender:{
        type: String,
        validate(value){
            if(!["male","female","others"].includes(value)){
                throw new Error("Gender Not Valid");
            }
        }
    },
    photoUrl:{
        type : String,
        default : "https://static.vecteezy.com/system/resources/previews/045/944/199/non_2x/male-default-placeholder-avatar-profile-gray-picture-isolated-on-background-man-silhouette-picture-for-user-profile-in-social-media-forum-chat-greyscale-illustration-vector.jpg",
        validate(value){
            if(!validator.isURL(value)){
                throw new Error("Invalid Photo URL");
            }
        }
    },
    about:{
        type : String,
        default : "This is the default for the User",
    },
    skills:{
        type : [String],
    },

    // PR V2 🚀
    interests:{
        type : [String],
        index : true,
        default : [],
    },
    isPrivate:{
        type : Boolean,
        default : false,
    },
    isVerified:{
        type : Boolean,
        default : false,
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    blockedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
    }],
    followersCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    followingCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    postsCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    settings: {
        notifications: {
            type: Boolean,
            default: true,
        },
        showOnlineStatus: {
            type: Boolean,
            default: true,
        },
    },
    lastActiveAt: {
        type: Date,
    },
    accountStatus: {
        type: String,
        enum: ["active", "deleted", "deactivated", "suspended"],
        default: "active",
    }
},
{
    timestamps:true
});

module.exports = mongoose.model("user",userSchema);
