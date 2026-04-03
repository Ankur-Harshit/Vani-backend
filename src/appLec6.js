const express = require('express');
const connectDB = require("./config/database");
const app = express();
const User = require("./models/user");

// first connect to the dataBase and then listen to the server to avoid any issue
// we are importing connectDB from the database and then we are here calling the func
// and after connecting to the database, we are listening to the server

app.post("/signup", async(req, res)=>{
    const user = new User({
        firstName: "MS",
        lastName: "Dhoni",
        emailId: "mahendra@dhoni.com",
        password: "mahi",
    });
    try{
        await user.save();
        res.send("User Added");
    }catch(error){
        res.status(400).send("Cannot Add User");
    }
})


connectDB().then(()=>{
    console.log("Connection Established Done");
    app.listen(3000, ()=>{
        console.log("Server is sucessfully listening on port 3000...");
    })
}).catch((err)=>{
    console.error("Cannot Connect due to an Error");
});
