const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
dotenv.config();

const userRoutes = require("./routes/user");
const dashboardRoutes = require("./routes/dashboard");
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded profile pictures statically
app.use("/images", express.static(path.join(__dirname, "images")));

// Mount user and chart routes directly under /api/v1
app.use("/api/v1", userRoutes);
app.use("/api/v1", dashboardRoutes);

app.listen(process.env.PORT, () => {
  console.log(`Connected Successfully ${process.env.PORT} `);
  console.log("DATABASE =", process.env.DATABASE);
  console.log("DB_USER =", process.env.DB_USER);
  console.log("DB_PASSWORD =", process.env.DB_PASSWORD);
  console.log("DB_HOST =", process.env.DB_HOST);
});
