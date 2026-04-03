const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isProfileUpload = file.fieldname === "profilePic";

    return {
      folder: isProfileUpload ? "pullrequest_profiles" : "pullrequest_posts",
      resource_type: "auto",
      allowed_formats: ["jpg", "png", "jpeg", "webp", "mp4", "mov", "webm"],
    };
  },
});

const upload = multer({ storage });
module.exports = {upload};
