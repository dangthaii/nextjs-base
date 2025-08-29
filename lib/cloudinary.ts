import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a base64 image to Cloudinary
 * @param base64Data - Base64 encoded image data (with or without data URL prefix)
 * @param options - Upload options
 * @returns Promise with Cloudinary upload result
 */
export async function uploadImageToCloudinary(
  base64Data: string,
  options?: {
    folder?: string;
    public_id?: string;
    transformation?: any;
  }
): Promise<{
  success: boolean;
  url?: string;
  public_id?: string;
  error?: string;
}> {
  try {
    // Ensure the base64 data has the proper data URL format
    let dataUrl = base64Data;
    if (!base64Data.startsWith("data:")) {
      // Assume it's PNG if no format is specified
      dataUrl = `data:image/png;base64,${base64Data}`;
    }

    const uploadOptions = {
      folder: options?.folder || "paragraph-images",
      public_id: options?.public_id,
      transformation: options?.transformation,
      resource_type: "image" as const,
    };

    const result = await cloudinary.uploader.upload(dataUrl, uploadOptions);

    return {
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error: any) {
    console.error("Cloudinary upload error:", error);
    return {
      success: false,
      error: error.message || "Failed to upload image to Cloudinary",
    };
  }
}

/**
 * Delete an image from Cloudinary
 * @param publicId - The public ID of the image to delete
 * @returns Promise with deletion result
 */
export async function deleteImageFromCloudinary(publicId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await cloudinary.uploader.destroy(publicId);
    return { success: true };
  } catch (error: any) {
    console.error("Cloudinary delete error:", error);
    return {
      success: false,
      error: error.message || "Failed to delete image from Cloudinary",
    };
  }
}

/**
 * Generate a transformation URL for an existing Cloudinary image
 * @param publicId - The public ID of the image
 * @param transformations - Cloudinary transformation parameters
 * @returns Transformed image URL
 */
export function getTransformedImageUrl(
  publicId: string,
  transformations?: {
    width?: number;
    height?: number;
    crop?: string;
    quality?: string | number;
    format?: string;
  }
): string {
  return cloudinary.url(publicId, {
    ...transformations,
    secure: true,
  });
}

export default cloudinary;
