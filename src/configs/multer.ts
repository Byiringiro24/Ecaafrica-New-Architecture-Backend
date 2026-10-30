import fs from "fs";
import path from "path";
import multer from "multer";
import { AppError } from "../middleware/errorHandler";

// Must match the directory express serves at /uploads in app.ts
const uploadDir = path.resolve(__dirname, "..", "..", "uploads");
const logoDir = path.join(uploadDir, "logos");

for (const dir of [uploadDir, logoDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const buildFilename = (originalname: string) => {
  const ext = path.extname(originalname);
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${unique}${ext}`;
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    cb(null, buildFilename(file.originalname));
  }
});

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, logoDir);
  },
  filename: (_req, file, cb) => {
    cb(null, buildFilename(file.originalname));
  }
});

const csvFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const isCsv =
    file.mimetype === "text/csv" ||
    file.mimetype === "application/csv" ||
    file.mimetype === "application/vnd.ms-excel" ||
    file.originalname.toLowerCase().endsWith(".csv");

  if (!isCsv) {
    cb(new AppError("bad_request", "Only CSV files are allowed", 400));
    return;
  }

  cb(null, true);
};

export const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const isSupportedImageFile = (file: Pick<Express.Multer.File, "mimetype" | "originalname">) => {
  const mimeType = file.mimetype?.toLowerCase();
  const fileName = file.originalname?.toLowerCase() ?? "";
  const supportedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

  return SUPPORTED_IMAGE_TYPES.includes(mimeType as typeof SUPPORTED_IMAGE_TYPES[number]) ||
    supportedExtensions.some((ext) => fileName.endsWith(ext));
};

const imageFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (!isSupportedImageFile(file)) {
    cb(new AppError("bad_request", "Only JPG, PNG, and WEBP images are allowed", 400));
    return;
  }

  cb(null, true);
};

export const uploadCsv = multer({
  storage,
  fileFilter: csvFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

export const uploadStudentPhoto = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

export const uploadSchoolLogo = multer({
  storage: logoStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024
  }
});

const receiptFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const allowed =
    file.mimetype.startsWith("image/") ||
    file.mimetype === "application/pdf" ||
    file.originalname.toLowerCase().endsWith(".pdf");

  if (!allowed) {
    cb(new AppError("bad_request", "Only image or PDF files are allowed", 400));
    return;
  }

  cb(null, true);
};

export const uploadPaymentReceipt = multer({
  storage,
  fileFilter: receiptFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});
