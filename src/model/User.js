import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      min: 2,
      max: 100,
    },
    email: {
      type: String,
      required: true,
      max: 100,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      min: 2,
      max: 100,
    },
    authCode: String, // authentication code
    websiteUrl: String,
    redirectUrl: String,
    callbackUrl: String,  
    currency: String,
    // {
    //   type: String,
    //   enum: ["BDT", "INR", "USD"],
    //   default: "BDT",
    // },
    apiKey: String,
    role: {
      type: String,
      enum: ["merchant","agent","subadmin", "admin"],
      default: "merchant",
    },
    status: {
      type: String,
      enum: ["activated", "deactivated"],
      default: "activated",
    },
    mode: {
      type: String,
      enum: ["test", "live"],
      default: "live",
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", UserSchema);
export default User;