/**
 * 回复框粘贴：从 HTML / 剪贴板解析图片（对齐 kelailaichatpc）
 */

/** @param {string} html */
export function listImgSrcsFromHtml(html) {
  if (!html || typeof html !== 'string') return []
  const srcs = []
  const re = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi
  let m
  while ((m = re.exec(html))) {
    const src = (m[1] || m[2] || m[3] || '').trim()
    if (src) srcs.push(src)
  }
  return srcs
}

/** HTML → 纯文本（保留换行） */
export function htmlClipboardToPlainText(html) {
  if (!html || typeof html !== 'string') return ''
  const doc = String(html).replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
  return doc
    .replace(/<\/(p|div|tr|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function collapseExactDuplicatePasteText(text) {
  if (text == null) return ''
  const s = String(text)
  const len = s.length
  if (len < 2 || len % 2 !== 0) return s
  const half = len / 2
  const a = s.slice(0, half)
  const b = s.slice(half)
  return a === b ? a : s
}

export function fileUrlToLocalPath(src) {
  if (!src) return ''
  const s = String(src).trim()
  if (/^[a-zA-Z]:[\\/]/.test(s) || s.startsWith('\\\\')) {
    return s.replace(/\//g, '\\')
  }
  if (!/^file:/i.test(s)) return ''
  try {
    const u = new URL(s)
    let p = decodeURIComponent(u.pathname || '')
    if (/^\/[a-zA-Z]:\//.test(p)) p = p.slice(1)
    return p.replace(/\//g, '\\')
  } catch (_) {
    return ''
  }
}

const LOCAL_IMAGE_EXT_RE = /\.(png|jpe?g|jfif|gif|bmp|webp|heic|heif)$/i

export function hasLocalImageExtension(nameOrPath) {
  if (!nameOrPath) return false
  const base = String(nameOrPath).trim().split(/[\\/]/).pop() || ''
  return LOCAL_IMAGE_EXT_RE.test(base)
}

export function localImagePathFromClipboardText(text) {
  const path = localAbsolutePathFromText(text)
  if (!path || !hasLocalImageExtension(path)) return ''
  return path
}

export function localAbsolutePathFromText(text) {
  if (text == null) return ''
  let s = String(text).trim()
  if (!s) return ''
  if (/[\r\n]/.test(s)) {
    s =
      s
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))[0] || ''
  }
  if (!s) return ''
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim()
  }
  const fromUrl = fileUrlToLocalPath(s)
  if (fromUrl) return fromUrl
  if (!/^[a-zA-Z]:[\\/]/.test(s) && !s.startsWith('\\\\')) return ''
  return s.replace(/\//g, '\\')
}

export function isImageFileLike(file) {
  if (!file) return false
  const mime = file.type && String(file.type).toLowerCase()
  if (mime && mime.startsWith('image/')) return true
  return hasLocalImageExtension(file.name || '')
}

export function hasImageMagicBytes(bytes) {
  if (!bytes || bytes.length < 3) return false
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return true
  if (b[0] === 0x42 && b[1] === 0x4d) return true
  if (
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return true
  }
  return false
}

function readFileHeadBuffer(file, maxLen) {
  const n = Math.max(1, maxLen || 16)
  return new Promise((resolve) => {
    try {
      const part = typeof file.slice === 'function' ? file.slice(0, n) : file
      if (part && typeof part.arrayBuffer === 'function') {
        part
          .arrayBuffer()
          .then((buf) => resolve(buf || null))
          .catch(() => resolve(null))
        return
      }
      if (typeof FileReader === 'undefined') {
        resolve(null)
        return
      }
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result || null)
      fr.onerror = () => resolve(null)
      fr.readAsArrayBuffer(part)
    } catch (_) {
      resolve(null)
    }
  })
}

export async function fileHasImageMagic(file) {
  if (!file || !(file.size > 0)) return false
  if (file.size < 32) return false
  try {
    const buf = await readFileHeadBuffer(file, 16)
    if (!buf || !buf.byteLength) return false
    if (!hasImageMagicBytes(new Uint8Array(buf))) return false
    if (typeof createImageBitmap === 'function') {
      try {
        const bmp = await createImageBitmap(file)
        const ok = !!(bmp && bmp.width > 0 && bmp.height > 0)
        if (bmp && typeof bmp.close === 'function') bmp.close()
        return ok
      } catch (_) {
        return false
      }
    }
    return true
  } catch (_) {
    return false
  }
}

/** 上传前重编码 JPEG，缩小体积、加快企微手机端拉取 */
export async function reencodeClipboardImageFile(file) {
  if (!file || !(file.size > 0)) return null
  const asFile =
    file instanceof File
      ? file
      : new File([file], `paste-${Date.now()}.bin`, {
          type: file.type || 'application/octet-stream'
        })

  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return asFile
  }
  let bitmap = null
  try {
    bitmap = await createImageBitmap(asFile)
    if (!bitmap || !(bitmap.width > 0) || !(bitmap.height > 0)) return null
    const maxEdge = 1920
    let w = bitmap.width
    let h = bitmap.height
    if (w > maxEdge || h > maxEdge) {
      const scale = maxEdge / Math.max(w, h)
      w = Math.round(w * scale)
      h = Math.round(h * scale)
    }
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, w, h)
    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b || null), 'image/jpeg', 0.88)
    })
    if (!blob || !(blob.size > 0)) return null
    const base =
      (asFile.name && String(asFile.name).replace(/\.[^.]+$/, '')) || `paste-${Date.now()}`
    return new File([blob], `${base}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now()
    })
  } catch (_) {
    return null
  } finally {
    if (bitmap && typeof bitmap.close === 'function') {
      try {
        bitmap.close()
      } catch (_) {
        /* ignore */
      }
    }
  }
}

export async function reencodeClipboardImageFiles(files) {
  const list = Array.isArray(files) ? files : []
  const results = await Promise.all(
    list.map(async (f) => {
      const encoded = await reencodeClipboardImageFile(f)
      if (encoded) return encoded
      if (f instanceof File) return f
      return null
    })
  )
  return results.filter(Boolean)
}

export function createPendingImageEntry(url, file) {
  if (!url) return url
  let preview = ''
  try {
    if (file && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      preview = URL.createObjectURL(file)
    }
  } catch (_) {
    preview = ''
  }
  if (preview) return { url, preview }
  return url
}

export function pendingImageSendUrl(item) {
  if (!item) return ''
  if (typeof item === 'string') return item
  return item.url || ''
}

export function revokePendingImagePreview(item) {
  if (!item || typeof item !== 'object' || !item.preview) return
  try {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(item.preview)
    }
  } catch (_) {
    /* ignore */
  }
}

export function collectClipboardImageFiles(clipboardData) {
  if (!clipboardData) return []
  const fromItems = []
  const items = Array.from(clipboardData.items || [])
  items.forEach((item) => {
    if (!item || item.kind === 'string') return
    const file = typeof item.getAsFile === 'function' ? item.getAsFile() : null
    if (file && isImageFileLike(file)) fromItems.push(file)
  })
  if (fromItems.length > 0) return fromItems
  return Array.from(clipboardData.files || []).filter((f) => isImageFileLike(f))
}
