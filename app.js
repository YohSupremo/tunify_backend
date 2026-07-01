const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
dotenv.config();

const userRoutes = require("./routes/user");
const dashboardRoutes = require("./routes/dashboard");
const categoryRoutes = require("./routes/category");
const brandRoutes = require("./routes/brand");
const supplierRoutes = require("./routes/supplier");
const itemRoutes = require("./routes/item");
const stockRoutes = require("./routes/stock");
const orderRoutes = require("./routes/order");
const customerRoutes = require("./routes/customer");
const reviewRoutes = require("./routes/review");
const settingsRoutes = require("./routes/settings");
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded profile pictures statically
app.use("/images", express.static(path.join(__dirname, "images")));

// Mount user and chart routes directly under /api/v1
app.use("/api/v1", userRoutes);
app.use("/api/v1", dashboardRoutes);
app.use("/api/v1", categoryRoutes);
app.use("/api/v1", brandRoutes);
app.use("/api/v1", supplierRoutes);
app.use("/api/v1", itemRoutes);
app.use("/api/v1", stockRoutes);
app.use("/api/v1", orderRoutes);
app.use("/api/v1", customerRoutes);
app.use("/api/v1", reviewRoutes);
app.use("/api/v1", settingsRoutes);

app.listen(process.env.PORT, () => {
  console.log(`Connected Successfully ${process.env.PORT} `);
  console.log("DATABASE =", process.env.DATABASE);
  console.log("DB_USER =", process.env.DB_USER);
  console.log("DB_PASSWORD =", process.env.DB_PASSWORD);
  console.log("DB_HOST =", process.env.DB_HOST);
});
