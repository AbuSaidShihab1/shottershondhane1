import express from "express"
const agent_route=express.Router();
import multer from "multer";
import bcrypt from "bcryptjs"
import Agent_model from "../model/Agentregistration.js";
import agent_deposit_model from "../model/Agentdeposit.js";
// import XLSX  from "XLSX"
import agent_ticket_model from "../model/Agentticket.js";
const storage=multer.diskStorage({
    destination:function(req,file,cb){
        cb(null,"./public/images")
    },
    filename:function(req,file,cb){
        cb(null,`${Date.now()}_${file.originalname}`)
    }

});
const uploadimage=multer({storage:storage});
agent_route.post("/agent-registration",uploadimage.single("file"),async(req,res)=>{
    try {
        const {name,email,phone,password}=req.body;
        const find_agent=await Agent_model.findOne({phone:phone});
        console.log(req.file)
        if(find_agent){
            res.send({success:false,message:"Agent Already Exist!"})
        }
        if(!find_agent){
            const hash_pass=await bcrypt.hash(password,10);
            const new_agent=new Agent_model({
                name,email,password:hash_pass,phone,nid_or_passport:req.file.filename
            });
            if(new_agent){
            new_agent.save();
            res.send({success:true,message:"Agent Registration Successful!",agent_info:new_agent})
            }
            res.send({success:false,message:"Somehting went wrong!"})
        }
    } catch (error) {
        console.log(error)
    }
});

// -------------agent login
agent_route.post("/agent-login",async(req,res)=>{
    try {
        const {phone,password}=req.body;
        const match_agnet=await Agent_model.findOne({phone:phone});
        if(!match_agnet){
            res.send({success:false,message:"Your phone number and password is incorrect!"});
        }
        if(match_agnet){
            const compare_pass=await bcrypt.compare(password,match_agnet.password);
            if(compare_pass){
                if(match_agnet)
                  res.send({success:true,message:"Login Successful!",agent_info:match_agnet})
               }
             res.send({success:false,message:"Your phone number and password is incorrect!"})
        }
    } catch (error) {
        console.log(error)
    }
})
// --------------agent deposit
const generateInvoiceId = async () => {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const randomNum = Math.floor(1000 + Math.random() * 9000); // Random 4-digit number
  return `INV-${timestamp}-${randomNum}`;
};
agent_route.post("/agent-deposit-money",async(req,res)=>{
    try {
            const invoiceId = await generateInvoiceId();
         const {bkash_agent,provider_name,amount,payer_number,transition_id,agent_id}=req.body;
         if(!bkash_agent || !provider_name || !amount || !payer_number || !transition_id || !agent_id){
            res.send({success:false,message:"Please fill up your information!"})
         };
         const match_transiction=await agent_deposit_model.findOne({transiction_id:transition_id})
         if(match_transiction){
            res.send({success:false,message:"Transcition ID already exist!"})
         }
         const create_deposit=new agent_deposit_model({
            invoice_id:invoiceId,agent_number:bkash_agent,provider_name,amount,payer_number,transiction_id:transition_id,agent_id
          });
          if(create_deposit){
            create_deposit.save();
            res.send({success:true,message:"Deposit created successul!"})
          }
    } catch (error) {
        console.log(error)
    }
});
// ------------------agent deposit histroy-------
agent_route.put("/agent-deposit-status/:id",async(req,res)=>{
    try {
      const update_deposit_history=await agent_deposit_model.findByIdAndUpdate({_id:req.params.id},{status:req.body.status},{new:true});
      if(update_deposit_history){
         res.send({success:true,message:"Status updated successful!"})
      }
    } catch (error) {
        console.log(error)
    }
});
// ------------update deposit histroy-----------

// --------------agent data------------
agent_route.get("/agent-data",async(req,res)=>{
    try {
        const all_agent=await Agent_model.find({status:"activated"});
        const pending_agent=await Agent_model.find({status:"deactivated"});
        const agent_deposit_data=await agent_deposit_model.find();
          res.send({success:true,agent:all_agent,pending_agent:pending_agent,agent_deposit_data})
    } catch (error) {
        console.log(error)
    }
});
// --------------agent details------------
agent_route.get("/agent-details/:id",async(req,res)=>{
    try {
        const agent_details=await Agent_model.findById({_id:req.params.id});
        if(!agent_details){
            res.send({success:false,message:"Something went wrong!"});
        }
          res.send({success:true,agent:agent_details})
    } catch (error) {
        console.log(error)
    }
});
agent_route.get("/agent-deposit/:id",async(req,res)=>{
    try {
        const agent_data=await agent_deposit_model.find({agent_id:req.params.id});
        const get_full_amount=await agent_deposit_model.find({agent_id:req.params.id,status:"fully paid"});
        let total_amount=0; 
        get_full_amount.forEach((amoun)=>{
            total_amount=total_amount+amoun.amount;
         })
         const total_commission=Math.floor((total_amount/100)*2);
        if(!agent_data){
            res.send({success:false,message:"Something went wrong!"});
        }
        const update_agent_deposit_amount=await Agent_model.findByIdAndUpdate({_id:req.params.id},{$set:{deposit_amount:total_amount}})
        res.send({success:true,data:agent_data,total_amount_of_deposit:total_amount,total_commission})
    } catch (error) {
        console.log(error)
    }
});
// ------------update agent-------------
agent_route.put("/agent-update/:id",async(req,res)=>{
    try {
        const agent_details=await Agent_model.findByIdAndUpdate({_id:req.params.id},{$set:{status:"activated"}});
        if(!agent_details){
            res.send({success:false,message:"Something went wrong!"});
        }
          res.send({success:true,message:"Agent has been approved!"})
    } catch (error) {
        console.log(error)
    }
});
// delete agent
agent_route.delete("/agent-delete/:id",async(req,res)=>{
    try {
        const agent_details=await Agent_model.findByIdAndDelete({_id:req.params.id});
          res.send({success:true,message:"Agent has been deleted!"})
    } catch (error) {
        console.log(error)
    }
});
// download deposit data of specofic agent
// agent_route.get('/download-excel/:id', async (req, res) => {
//     try {
//         // Sample data to be exported
//       const agent_data=await agent_deposit_model.find({agent_id:req.params.id}).lean();
//         console.log(agent_data)
//         // Convert JSON data to a worksheet
//         const formattedData = agent_data.map((agent_data) => ({
//             Payer_Number: agent_data.payer_number,
//             Transiction_Id: agent_data.age,
//             Amount: agent_data.amount,
//             Status:agent_data.status
//         }));
//         const worksheet = XLSX.utils.json_to_sheet(formattedData);
//         const workbook = XLSX.utils.book_new();
//         XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

//         // Write workbook to buffer
//         const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

//         // Set response headers
//         res.setHeader('Content-Disposition', 'attachment; filename=data.xlsx');
//         res.setHeader('Content-Type', 'application/octet-stream');
//         res.send(buffer);
//     } catch (err) {
//         res.status(500).send({ error: 'Failed to generate Excel file' });
//     }
// });
agent_route.delete("/agent-deposit-history-delete/:id",async(req,res)=>{
    try {
        const agent_details=await agent_deposit_model.findByIdAndDelete({_id:req.params.id});
          res.send({success:true,message:"Agent has been deleted!"})
    } catch (error) {
        console.log(error)
    }
});
// -----------agent ticket-------------
agent_route.post("/agent-ticket",async(req,res)=>{
    try {
            const {message,agent_id}=req.body;
            if(!message || !agent_id){
                res.send({success:false,message:"Please fill up your message!"});
            }
            const create_ticket=new agent_ticket_model({message,agent_id});
            if(create_ticket){
                 create_ticket.save();
                 res.send({success:true,message:"Ticket Created Successful!"})
            }
    } catch (error) {
        console.log(error)
    }
});
// -------------------ticket data----------------
agent_route.get("/agent-ticket/:id",async(req,res)=>{
    try {
      const ticket_info=await agent_ticket_model.find({agent_id:req.params.id});
      res.send({success:true,ticket:ticket_info})
    } catch (error) {
        console.log(error)
    }
});
export default agent_route