import mongoose from "mongoose"

const Ticket_Schema=new mongoose.Schema({
    message:{
        type:String,
        required:true
    },
    agent_id:{
        type:String,
        required:true
    }
},{timestamps:true});

const agent_ticket_model=mongoose.model("Agent_ticket",Ticket_Schema);

export default agent_ticket_model;