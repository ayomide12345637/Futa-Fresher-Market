// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const dotenv = require("dotenv");
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ===== CONFIG =====
const PORT = process.env.PORT || 5000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "MELOX@FUTA29";

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error", err));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } });

// ===== SCHEMAS =====
const Section = mongoose.model("Section", new mongoose.Schema({
  title: { type: String, required: true }
}, { timestamps: true }));

const Product = mongoose.model("Product", new mongoose.Schema({
  title: String,
  price: Number,
  available: { type: Boolean, default: true },
  section: { type: mongoose.Schema.Types.ObjectId, ref: "Section" },
  short: String,
  full: String,
  location: String,
  images: [String],
  video: String
}, { timestamps: true }));

// ===== ADMIN CHECK =====
function checkAdmin(req, res, next) {
  if (req.headers["x-admin-password"] !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

// ===== SECTION ROUTES =====
app.get("/sections", async (req, res) => {
  const sections = await Section.find().sort({ createdAt: -1 });
  res.json(sections);
});

app.post("/sections", checkAdmin, async (req, res) => {
  const title = req.body.title || (req.body.get && req.body.get("title"));
  if (!title) return res.status(400).json({ error: "Title required" });
  const section = await Section.create({ title });
  res.json(section);
});

app.put("/sections/:id", checkAdmin, async (req, res) => {
  const section = await Section.findByIdAndUpdate(req.params.id, { title: req.body.title }, { new: true });
  res.json(section);
});

app.delete("/sections/:id", checkAdmin, async (req, res) => {
  await Section.findByIdAndDelete(req.params.id);
  res.json({ message: "Section deleted" });
});

// ===== PRODUCT ROUTES =====
app.get("/products", async (req, res) => {
  const products = await Product.find().populate("section").sort({ createdAt: -1 });
  res.json(products);
});

app.get("/products/:id", async (req, res) => {
  const product = await Product.findById(req.params.id).populate("section");
  if (!product) return res.status(404).json({ error: "Not found" });
  res.json(product);
});

app.post("/products", checkAdmin, upload.fields([{ name: "images" }, { name: "video" }]), async (req, res) => {
  try {
    const { title, price, available, section, short, full, location } = req.body;

    // upload images
    let imageUrls = [];
    if (req.files["images"]) {
      for (const file of req.files["images"]) {
        const result = await cloudinary.uploader.upload(file.path, { folder: "futa-market" });
        imageUrls.push(result.secure_url);
      }
    }

    // upload video
    let videoUrl = null;
    if (req.files["video"]) {
      const result = await cloudinary.uploader.upload(req.files["video"][0].path, {
        folder: "futa-market",
        resource_type: "video"
      });
      videoUrl = result.secure_url;
    }

    const product = await Product.create({
      title,
      price,
      available: available === "true",
      section,
      short,
      full,
      location,
      images: imageUrls,
      video: videoUrl
    });

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/products/:id", checkAdmin, upload.fields([{ name: "images" }, { name: "video" }]), async (req, res) => {
  try {
    const { title, price, available, section, short, full, location } = req.body;

    let updateData = { title, price, available: available === "true", section, short, full, location };

    // replace images if new ones uploaded
    if (req.files["images"]) {
      let imageUrls = [];
      for (const file of req.files["images"]) {
        const result = await cloudinary.uploader.upload(file.path, { folder: "futa-market" });
        imageUrls.push(result.secure_url);
      }
      updateData.images = imageUrls;
    }

    // replace video if new one uploaded
    if (req.files["video"]) {
      const result = await cloudinary.uploader.upload(req.files["video"][0].path, {
        folder: "futa-market",
        resource_type: "video"
      });
      updateData.video = result.secure_url;
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/products/:id", checkAdmin, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: "Product deleted everywhere" });
});

// ===== START =====
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));