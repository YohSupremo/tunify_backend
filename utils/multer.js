const multer = require("multer");
const path = require("path");
const fs = require("fs");




const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, "..", "images");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname).toLowerCase();
        const baseName = path.parse(file.originalname).name.replace(/\\/g, "/");
        cb(null, baseName + "-" + uniqueSuffix + ext);
    }
});

module.exports = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext !== ".jpg" && ext !== ".jpeg" && ext !== ".png") {
            cb(new Error("Unsupported file type!"), false);
            return;
        }
        cb(null, true);
    }
});
