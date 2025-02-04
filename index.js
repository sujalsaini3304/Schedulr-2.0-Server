import express from "express";
import router from "./router.js";
import dotenv from "dotenv";

dotenv.config({
  path: ".env",
});

// Instance of express
const app = express();
const SERVER_PORT = process.env.SERVER_PORT;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/", router);

// Listening
app.listen(SERVER_PORT, (req, res) => {
  console.log("Server Started");
});






