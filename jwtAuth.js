import jwt from "jsonwebtoken"
import dotenv from "dotenv";

dotenv.config({
  path: ".env",
});

const {JWT_SECRET_SIGNATURE_CODE , JWT_EXPIRY_DATE } = process.env;

// Require - jwtAuthToken
const jwtAuthMiddleware = (req , res , next)=>{
    
    const token = req.body.jwtAuthToken;

    if(!token){
      res.status(404).json({
        message:"Unauthorized",
        status:0,
      });
    }

    try {
        const varificationResult = jwt.verify( token ,  JWT_SECRET_SIGNATURE_CODE);
        req.user = varificationResult;
        next();
    } catch (error) {
     console.log(error);
     res.status(404).json({
        message:"Invalid Token",
        status:0,
     })   
    }
}

const generateJwtToken = (payload)=>{
    try {
      const token = jwt.sign(payload, process.env.JWT_SECRET_SIGNATURE_CODE, { expiresIn: JWT_EXPIRY_DATE });
      return token;
    } catch (error) {
      console.error("Error generating JWT:", error);
      throw new Error("JWT generation failed");
    }
}

export {
    jwtAuthMiddleware,
    generateJwtToken,
} 