import { Platform } from 'react-native';
import CryptoJS from 'crypto-js';
import { 
  CLOUDINARY_API_URL, 
  CLOUDINARY_CLOUD_NAME, 
  CLOUDINARY_API_KEY, 
  CLOUDINARY_API_SECRET 
} from '../config';

/**
 * Service to handle SIGNED uploads to Cloudinary directly from the frontend.
 * This uses the API Secret to sign requests.
 */
const cloudinaryService = {
  /**
   * Upload a file to Cloudinary using Signed API
   * @param {string} fileUri - Internal URI of the file
   * @param {string} fileName - Optional name
   * @param {string} mimeType - MIME type
   * @returns {Promise<string>} - The secure URL
   */
  async uploadFile(fileUri, fileName = 'upload', mimeType = '') {
    try {
      if (!fileUri) throw new Error('No file URI provided');
      if (!CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        throw new Error('Cloudinary API Key or Secret is not configured in .env');
      }

      const ext = (fileName.split('.').pop() || '').toLowerCase();
      const isRaw = [
        'dwg', 'skp', 'obj', 'fbx', '3ds', 'dae', 'blend', 'rvt', 'rfa', 'ifc',
        'gltf', 'glb', 'max', 'dxf', 'zip', 'rar', '7z', 'tar', 'stl', 'step', 'stp', 'pdf', 'txt'
      ].includes(ext);
      const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'tiff', 'hdr', 'exr'].includes(ext);

      // Raw files (3D models, CAD drawings, archives) must be uploaded to /raw/upload
      // otherwise /auto/upload attempts image decoding and fails with "Invalid image file"
      const resourceType = isRaw ? 'raw' : isImage ? 'image' : 'auto';
      const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

      // Resolve proper MIME type
      let resolvedMimeType = mimeType;
      if (!resolvedMimeType || resolvedMimeType === 'application/octet-stream') {
        if (isImage) {
          resolvedMimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        } else if (ext === 'pdf') {
          resolvedMimeType = 'application/pdf';
        } else if (ext === 'glb') {
          resolvedMimeType = 'model/gltf-binary';
        } else if (ext === 'gltf') {
          resolvedMimeType = 'model/gltf+json';
        } else if (ext === 'zip') {
          resolvedMimeType = 'application/zip';
        } else {
          resolvedMimeType = 'application/octet-stream';
        }
      }

      const timestamp = Math.round(new Date().getTime() / 1000);
      
      // For signed uploads, we hash folder + timestamp + API_SECRET
      const folder = 'pratham_app';
      const signatureString = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
      const signature = CryptoJS.SHA1(signatureString).toString();

      const formData = new FormData();
      
      const fileData = {
        uri: Platform.OS === 'ios' ? fileUri.replace('file://', '') : fileUri,
        type: resolvedMimeType,
        name: fileName || `file_${Date.now()}`
      };

      formData.append('file', fileData);
      formData.append('api_key', CLOUDINARY_API_KEY);
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);
      formData.append('folder', folder);

      if (__DEV__) console.log(`Performing Signed Upload to Cloudinary (${resourceType})...`, fileName);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = await response.json();

      if (response.ok) {
        if (__DEV__) console.log('Signed Upload successful:', data.secure_url);
        return data.secure_url;
      } else {
        console.error('Cloudinary Signed Upload failure:', data);
        throw new Error(data.error?.message || 'Failed to upload to Cloudinary');
      }
    } catch (error) {
      console.error('cloudinaryService error:', error);
      throw error;
    }
  }
};

export default cloudinaryService;
