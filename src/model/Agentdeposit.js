import mongoose from "mongoose"

const agent_deposit_schema=mongoose.Schema({
    invoice_id:{
        type:String,
        required:true
    },
    agent_number:{
        type:String,
        required:true
    },
    provider_name:{
        type:String,
        required:true
    },
        amount:{
        type:Number,
        required:true
    },
        payer_number:{
        type:String,
        required:true
    },
    transiction_id:{
        type:String,
        required:true
    },
    agent_id:{
        type:String,
        required:true
    },
    status:{
      type: String,
      enum: ["pending", "processing", "hold", "fully paid", "partially paid", "completed", "suspended", "expired"],
      default: "pending",
    }
},{timestamps:true});

const agent_deposit_model=mongoose.model("Agent_deposit_money",agent_deposit_schema);

export default agent_deposit_model;