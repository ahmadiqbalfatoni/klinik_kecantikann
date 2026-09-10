/**
 * @copyright (c) 2026 PT Marstech Global (info@marstech.co.id)
 * @project Standard
 * @file page.tsx
 * @description File untuk menggabungkan semua routing setup dan middleware
 * 
 * @author Fadil <risqullah.s.fadhilah@gmail.com>
 * @created 2026-07-14
 * 
 * @contributors
 * - Fadil <risqullah.s.fadhilah@gmail.com>
 * 
 * @lastModified Fadil (2026-08-03)
 * @version 1.0.1
 */


import cors from "cors";
import express from "express";

import APIV1 from "./routes/v1/index.js";

import { formatDateSystem } from "./routes/v1/components/tools/date_tools.js";
import { validateTimestamp } from "./middleware/validate_header.js";
import { useragentMiddleware } from "./middleware/allow_user_agent.js";
import secureHeader from "./middleware/secure_header.js";
import Logger from "./middleware/logger.js";

const app = express();

const allowedOrigins = process.env.ORIGIN
  ? process.env.ORIGIN.split(",").map((origin) => origin.trim())
  : ["*"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || !process.env.ORIGIN || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Timestamp",
      "X-Signature",
      "X-Credential",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    optionSuccessStatus: 200,
  })
);

// app.use(logger("dev"));
app.use(Logger);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Healthcheck / Root endpoint
app.get("/", (req, res) => {
  return res.status(200).json({
    status: "success",
    message: "Klinik Kecantikan Backend API is running",
    datetime: formatDateSystem(),
  });
});

app.get("/health", (req, res) => {
  return res.status(200).send("OK");
});

// useragentMiddleware,
// Middleware global untuk semua api
app.use(
  "/api/v1",
  [secureHeader, validateTimestamp],
  APIV1
);

app.use('/uploads', express.static('public/uploads'))

app.use((req, res, next) => {
  console.log(req.url)
  return res.status(404).json({
    status: "404",
    message: "Endpoint tidak ditemukan",
    datetime: formatDateSystem(),
  });
});




export default app;
