import express from "express";
import dotenv from "dotenv";

dotenv.config({
    path:'.env',
})

const router = express.Router();

router.get("/" , (req,res)=>{
    res.json({
        message:"Server Started",
        status:"okay"
    });
})


export default router ;