import { isSupportedImageFile, SUPPORTED_IMAGE_TYPES } from "../src/configs/multer";

describe("Supported image upload validation", () => {
  it("allows the image formats used across the tablet and admin workflows", () => {
    expect(isSupportedImageFile({ mimetype: "image/jpeg", originalname: "student.jpg" } as any)).toBe(true);
    expect(isSupportedImageFile({ mimetype: "image/png", originalname: "logo.png" } as any)).toBe(true);
    expect(isSupportedImageFile({ mimetype: "image/webp", originalname: "photo.webp" } as any)).toBe(true);
  });

  it("rejects unsupported image formats that would not work reliably in the tablet scan flow", () => {
    expect(isSupportedImageFile({ mimetype: "image/gif", originalname: "animation.gif" } as any)).toBe(false);
    expect(isSupportedImageFile({ mimetype: "image/bmp", originalname: "photo.bmp" } as any)).toBe(false);
    expect(isSupportedImageFile({ mimetype: "image/svg+xml", originalname: "logo.svg" } as any)).toBe(false);
  });

  it("lists the accepted image types clearly for the UI", () => {
    expect(SUPPORTED_IMAGE_TYPES).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });
});
