import { nanoid } from 'nanoid'

import { getMcpSocket } from '@/mcp/transport'

export async function compressImageWithMcp(
  bytes: Uint8Array,
  format: 'png' | 'jpg' | 'webp',
  options: { quality?: number; lossless?: boolean } = {}
): Promise<{ bytes: Uint8Array; size: number }> {
  const socket = getMcpSocket()
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    throw new Error('MCP server not connected')
  }

  const requestId = nanoid()
  const base64Bytes = btoa(String.fromCharCode(...bytes))

  const request = {
    type: 'compressRequest',
    id: requestId,
    payload: {
      bytes: base64Bytes,
      format,
      options
    }
  }

  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'compressResponse' && data.id === requestId) {
          socket.removeEventListener('message', handleMessage)
          if (data.error) {
            reject(new Error(data.error))
          } else {
            const binaryString = atob(data.payload.bytes)
            const outputBytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              outputBytes[i] = binaryString.charCodeAt(i)
            }
            resolve({
              bytes: outputBytes,
              size: data.payload.size
            })
          }
        }
      } catch {
        // ignore malformed messages
      }
    }

    socket.addEventListener('message', handleMessage)
    socket.send(JSON.stringify(request))

    // timeout after 10 seconds
    setTimeout(() => {
      socket.removeEventListener('message', handleMessage)
      reject(new Error('Compression timed out'))
    }, 10000)
  })
}
