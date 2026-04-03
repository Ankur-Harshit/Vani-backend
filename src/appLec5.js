// Handling multiple routes //

const express = require("express");
const app = express();
const {adminAuth} = require("./middlewares/auth");
// app.use("/user", 
// (req, res, next)=>{
//     next();
//     // res.send("Route 1 is Done");
// },
// (req,res, next)=>{
//     next();
//     // res.send("Route 2 is done");
// },
// (req,res, next)=>{
//     res.send("Route 3 is done");
// },
// (req,res, next)=>{
//     res.send("Route 4 is done");
// },
// (req,res, next)=>{
//     res.send("Route 5 is done");
// }

// )

// Middlewares //
// app.use("/user", (req, res, next)=>{
//     console.log("/user is handled, 1st route");
//     next();
// })

// app.use("/user", (req,res,next)=>{
//     console.log("Second Route");
//     next();
// }, 
// (req, res)=>{
//     console.log("Third Route");
//     res.send("Third Route");
// })

// using middleware for authentication System //

app.use("/admin", adminAuth)

app.use("/admin/getData", (req, res)=>{
    res.send("Data Sent Successfuly");
})
app.use("/admin/deleteData", (req, res)=>{
    res.send("Deleted the Data for User");
})

app.listen(4000, ()=>{
    console.log("Listening on Port 4000....");
})
