const validator = require("validator");

const validateSignUpData = (req)=>{
    const {firstName, lastName, emailId, password} = req.body;
    if(!firstName){
        throw new Error("Name not valid");
    }
    else if(!validator.isEmail(emailId)){
        throw new Error("Email Id is Not Valid");
    }
    else if(!validator.isStrongPassword(password)){
        throw new Error("Please Enter a Strong Password");
    }
}

const ValidateEditProfileData = (req)=>{
    const allowedEditFields = [
        "firstName",
        "lastName",
        "username",
        "emailId",
        "photoUrl",
        "gender",
        "age",
        "about",
        "skills",
    ];
    const isEditAllowed = Object.keys(req.body).every((field)=>
    allowedEditFields.includes(field));
    
    return isEditAllowed;
    
};

module.exports = {validateSignUpData, ValidateEditProfileData};