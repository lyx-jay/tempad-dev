import { ImagePool } from '@squoosh/lib'
import os from 'node:os'

let imagePool: any = null

function getImagePool() {
  if (!imagePool) {
    imagePool = new ImagePool(Math.max(1, Math.floor(os.cpus().length / 2)))
  }
  return imagePool
}

export async function compressImage(
  buffer: Buffer,
  format: 'png' | 'jpg' | 'webp',
  options: { quality?: number; lossless?: boolean } = {}
): Promise<{ buffer: Buffer; size: number }> {
  const pool = getImagePool()
  const image = pool.ingestImage(buffer)

  const encodeOptions: any = {}
  const quality = options.quality !== undefined ? Math.floor(options.quality * 100) : 75

  if (format === 'jpg') {
    encodeOptions.mozjpeg = {
      quality: quality
    }
  } else if (format === 'png') {
    encodeOptions.oxipng = {}
  } else if (format === 'webp') {
    encodeOptions.webp = {
      quality: quality,
      lossless: options.lossless ? 1 : 0
    }
  }

  await image.encode(encodeOptions)

  let result: any
  if (format === 'jpg') {
    result = await image.encodedWith.mozjpeg
  } else if (format === 'png') {
    result = await image.encodedWith.oxipng
  } else if (format === 'webp') {
    result = await image.encodedWith.webp
  }

  return {
    buffer: Buffer.from(result.binary),
    size: result.size
  }
}

export async function closeImagePool() {
  if (imagePool) {
    await imagePool.close()
    imagePool = null
  }
}
