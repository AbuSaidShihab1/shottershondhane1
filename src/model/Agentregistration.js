import  mongoose from "mongoose";

const Agent_schema=new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
       email:{
        type:String,
        required:true
    },
       phone:{
        type:String,
        required:true
    },
       password:{
        type:String,
        required:true
    },
    nid_or_passport:{
        type:String,
        required:true
    },
    status:{
        type:String,
        default:"deactivated"
    },
    deposit_amount:{
        type:Number,
        default:0
    }
},{timestamps:true});

const Agent_model=mongoose.model("Agent",Agent_schema);
 export default Agent_model;