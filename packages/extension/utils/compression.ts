import imageCompression from 'browser-image-compression'

export async function compressImageWithMcp(
  bytes: Uint8Array,
  format: 'png' | 'jpg' | 'webp',
  options: { quality?: number; lossless?: boolean } = {}
): Promise<{ bytes: Uint8Array; size: number }> {
  const blob = new Blob([bytes as BlobPart], { type: `image/${format}` })

  const compressionOptions: Record<string, unknown> = {
    maxSizeMB: 10, // Allow large images, adjust as needed
    useWebWorker: false
  }

  if (format === 'png' && options.lossless) {
    compressionOptions.fileType = 'image/png'
  } else if (options.quality) {
    compressionOptions.initialQuality = options.quality
  }

  const compressedFile = await imageCompression(blob as File, compressionOptions)
  const arrayBuffer = await compressedFile.arrayBuffer()
  const compressedBytes = new Uint8Array(arrayBuffer)

  return {
    bytes: compressedBytes,
    size: compressedBytes.byteLength
  }
}
