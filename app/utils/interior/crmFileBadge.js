// File type + badge for CRM design files (web: InteriorUploadDesignModal detectFileType / getFileBadgeInfo).
// The type comes from the stored fileType, else the file name, else the URL; the badge label is the
// extension when it is a known one, otherwise a plain 2D / 3D tag (never the raw file name).

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'tiff', 'hdr', 'exr'];
const MODEL_3D_EXTS = ['dwg', 'skp', 'obj', 'fbx', '3ds', 'dae', 'blend', 'rvt', 'rfa', 'ifc', 'gltf', 'glb', 'max'];
const CAD_EXTS = ['dxf', 'dwg'];
const ARCHIVE_EXTS = ['zip', 'rar', '7z', 'tar'];
const TYPES = ['image', 'pdf', 'cad', '3d-model', 'archive', 'document'];

function extractExtension(str) {
  if (!str) return '';
  const parts = String(str).split('?')[0].split('#')[0].split('.');
  if (parts.length < 2) return '';
  const candidate = (parts.pop() || '').trim().toLowerCase();
  return /^[a-z0-9]{2,5}$/.test(candidate) ? candidate : '';
}

export function detectCrmFileType(fileName, fileUrl, explicitType) {
  if (explicitType && TYPES.includes(explicitType)) return explicitType;
  const ext = extractExtension(fileName) || extractExtension(fileUrl);
  if (IMAGE_EXTS.includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (MODEL_3D_EXTS.includes(ext)) return '3d-model';
  if (CAD_EXTS.includes(ext)) return 'cad';
  if (ARCHIVE_EXTS.includes(ext)) return 'archive';
  return 'document';
}

const PURPLE = { color: '#9333EA', bg: '#F3E8FF' };
const BLUE = { color: '#2563EB', bg: '#DBEAFE' };

export function getCrmFileBadge(fileName, category, fileUrl, fileType) {
  const normCategory = String(category || '').toUpperCase();
  const ext = (extractExtension(fileName) || extractExtension(fileUrl)).toUpperCase();
  const type = detectCrmFileType(fileName, fileUrl, fileType);
  const known = (list) => ext && list.includes(ext.toLowerCase());

  if (ext === 'DWG') return { label: 'DWG', ...PURPLE };
  if (type === 'image') return { label: known(IMAGE_EXTS) ? ext : 'IMAGE', color: '#059669', bg: '#D1FAE5' };
  if (type === 'pdf') return { label: 'PDF', color: '#DC2626', bg: '#FEE2E2' };
  if (type === '3d-model') return { label: known(MODEL_3D_EXTS) ? ext : '3D MODEL', ...PURPLE };
  if (type === 'cad') return { label: known(CAD_EXTS) ? ext : '2D CAD', ...BLUE };
  if (type === 'archive') return { label: known(ARCHIVE_EXTS) ? ext : 'ARCHIVE', color: '#0891B2', bg: '#CFFAFE' };
  return normCategory.includes('3D') ? { label: '3D', ...PURPLE } : { label: '2D', ...BLUE };
}
