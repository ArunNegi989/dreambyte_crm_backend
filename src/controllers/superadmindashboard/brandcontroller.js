const Brand = require("../../models/superadmindashboard/brandmodel");

// Create Brand
exports.createBrand = async (req, res) => {
  try {
    const { name, industry, status } = req.body;
    const brand = await Brand.create({ name, industry, status });
    res.status(201).json({
      success: true,
      message: "Brand created successfully",
      data: brand,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get All Brands
exports.getBrands = async (req, res) => {
  try {
    const brands = await Brand.find().sort({ createdAt: -1 });
    res.json({ success: true, count: brands.length, data: brands });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Single Brand
exports.getBrand = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }
    res.json({ success: true, data: brand });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Brand
exports.updateBrand = async (req, res) => {
  try {
    const { name, industry, status } = req.body;
    const brand = await Brand.findByIdAndUpdate(
      req.params.id,
      { name, industry, status },
      { new: true, runValidators: true }
    );
    if (!brand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }
    res.json({ success: true, message: "Brand updated successfully", data: brand });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Brand
exports.deleteBrand = async (req, res) => {
  try {
    const brand = await Brand.findByIdAndDelete(req.params.id);
    if (!brand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }
    res.json({ success: true, message: "Brand deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};