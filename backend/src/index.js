import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";

import authRoutes from "./routes/auth-route.js";
import meetingRoutes from "./routes/meeting-route.js";
import { connectDB } from "./lib/db.js";
import { app, server } from "./lib/socket.js";

dotenv.config();
const PORT = process.env.PORT;
const __dirname = path.resolve();

app.use(express.json());

app.use(cookieParser());

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      process.env.FRONTEND_URL,
      "https://www.meethub.novanectar.co.in",
      "https://meethub.novanectar.co.in",
      "https://api.meethub.novanectar.co.in",
      "http://api.meethub.novanectar.co.in",
    ],
    credentials: true,
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);

app.get("/api/health-check", (req, res) => {
  res.status(200).json({ success: true, message: "backend is up and running" });
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

server.listen(PORT, () => {
  console.log("Server is running on :" + PORT);
  connectDB();
});
