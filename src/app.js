const express = require('express');
const app = express();


app.get("/user", (req, res)=>{
    res.send("Hello got the get Request");
})

app.post("/user", (req, res)=>{
    // post the data -> write the logic
    res.send("Posted the data successuly on the DB");
})

app.delete("/user", (req, res)=>{
    res.send("Deleted the data Successfuly");
})

app.use("/hello", (req, res)=>{
    res.send("Hello Hello Hello Amla Toli Durga Puja Samiti");
})

// app.use("/test", (req, res)=>{
//     res.send("Hello from the Testing Server");
// })

// app.use("/", (req, res)=>{
//     res.send("Hello from the Server");
// })


app.listen(3000, ()=>{
    console.log("Server is sucessfully listening on port 3000...");
})