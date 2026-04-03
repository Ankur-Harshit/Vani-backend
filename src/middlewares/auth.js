const jwt = require("jsonwebtoken");
const User = require("../models/user");


// const adminAuth = (req, res, next)=>{
//     const tok = "xyz";
//     const ValidAdmin = tok==="xyz";
//     if(!ValidAdmin){
//         res.status(401).send("Unauthorised Access");
//     }
//     else{
//         next();
//     }
// }

// module.exports = {
//     adminAuth
// }

const userAuth = async (req, res, next)=>{
    try {
            const cookies = req.cookies;
            const { token } = cookies;
            if(!token){
                return res.status(401).send("Login again!");
            }
    
            // validate the token //
            const decodedMessage = jwt.verify(token, "DEV@Tinder$790");
            // console.log(decodedMessage);
            const { _id } = decodedMessage;
            // console.log("ID of the logged in User is " + _id);
            const user = await User.findById(_id);
            if(!user){
                throw new Error("User does Not exist");
            }
            req.user = user;
            next();
            // console.log(user.firstName + " is Logged in");
    
    
            // to read a cookie, we need a cookie parser //
            // console.log(cookies);
            // res.send(user);
        }
        catch(error){
            res.status(400).send(error.message);
        }
};

module.exports = {
    userAuth
}