<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import JSZip from 'jszip'
import { ref, watch, onUnmounted } from 'vue'

import IconButton from '@/components/IconButton.vue'
import Check from '@/components/icons/Check.vue'
import Download from '@/components/icons/Download.vue'
import Section from '@/components/Section.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import { useToast } from '@/composables'
import { selectedNode } from '@/ui/state'
import { compressImageWithMcp } from '@/utils/compression'

const formatOptions = [
  { label: 'PNG', value: 'PNG' },
  { label: 'SVG', value: 'SVG' },
  { label: 'JPG', value: 'JPG' }
]

const scaleOptions = [
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '3x', value: 3 },
  { label: '4x', value: 4 }
] as const

const exportFormat = useStorage<'PNG' | 'SVG' | 'JPG'>('tempad-export-format', 'PNG')
const exportScales = useStorage<number>('tempad-export-scales', 1)
const compressImage = useStorage<boolean>('tempad-export-compress', true)

const previewUrl = ref<string | null>(null)
const isHovering = ref(false)

async function updatePreview() {
  const node = selectedNode.value
  if (!node) {
    previewUrl.value = null
    return
  }

  try {
    const bytes = await node.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: 1 }
    })
    const blob = new Blob([bytes as BlobPart], { type: 'image/png' })
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
    }
    previewUrl.value = URL.createObjectURL(blob)
  } catch (e) {
    console.error('Failed to export preview', e)
    previewUrl.value = null
  }
}

watch(selectedNode, updatePreview, { immediate: true })

onUnmounted(() => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
})

function toggleScale(scale: number) {
  exportScales.value = scale
}

interface ExportableAsset {
  id: string
  name: string
  node: SceneNode
  preview?: string
}

const exportableAssets = ref<ExportableAsset[]>([])

async function addToAssets() {
  const node = selectedNode.value
  if (!node) return

  // Prevent duplicates
  if (exportableAssets.value.some((a) => a.id === node.id)) return

  try {
    const bytes = await node.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: 0.2 }
    })
    const blob = new Blob([bytes as BlobPart], { type: 'image/png' })
    const preview = URL.createObjectURL(blob)

    exportableAssets.value.push({
      id: node.id,
      name: node.name,
      node: node,
      preview
    })
  } catch (e) {
    console.error('Failed to add to assets', e)
  }
}

async function exportAsset(node: SceneNode, format: 'PNG' | 'SVG' | 'JPG', scale: number) {
  try {
    const { blob, filename } = await getAssetData(node, format, scale)
    downloadBlob(blob, filename)
  } catch (e) {
    console.error('Export failed', e)
  }
}

async function getAssetData(node: SceneNode, format: 'PNG' | 'SVG' | 'JPG', scale: number) {
  const bytes = await node.exportAsync({
    format,
    constraint: { type: 'SCALE', value: scale }
  })

  if (compressImage.value && format !== 'SVG') {
    try {
      const result = await compressImageWithMcp(bytes, format.toLowerCase() as 'png' | 'jpg', {
        quality: format === 'JPG' ? 0.9 : 1.0,
        lossless: format === 'PNG'
      })
      return {
        blob: new Blob([result.bytes as BlobPart], { type: `image/${format.toLowerCase()}` }),
        filename: `${node.name}${scale > 1 ? `@${scale}x` : ''}.${format.toLowerCase()}`
      }
    } catch (error) {
      console.warn('Compression failed, using original', error)
    }
  }

  return {
    blob: new Blob([bytes as BlobPart], { type: `image/${format.toLowerCase()}` }),
    filename: `${node.name}${scale > 1 ? `@${scale}x` : ''}.${format.toLowerCase()}`
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function exportAll() {
  const toast = useToast()
  const zip = new JSZip()
  const assetsToExport = []

  if (exportableAssets.value.length === 0) {
    toast.show('No assets to export.')
    return
  }

  if (!exportScales.value) {
    toast.show('No scale selected for export.')
    return
  }

  const usedFilenames = new Set<string>()

  for (const asset of exportableAssets.value) {
    try {
      const data = await getAssetData(asset.node, exportFormat.value, exportScales.value)
      assetsToExport.push(data)

      let filename = data.filename
      if (usedFilenames.has(filename)) {
        const dotIndex = filename.lastIndexOf('.')
        const base = dotIndex === -1 ? filename : filename.slice(0, dotIndex)
        const ext = dotIndex === -1 ? '' : filename.slice(dotIndex)
        let i = 1
        do {
          filename = `${base}-${i}${ext}`
          i += 1
        } while (usedFilenames.has(filename))
      }

      usedFilenames.add(filename)
      zip.file(filename, data.blob)
    } catch (error) {
      console.error(`Failed to export ${asset.name}`, error)
      toast.show(`Failed to export ${asset.name}`)
    }
  }

  if (assetsToExport.length === 0) return

  if (assetsToExport.length === 1) {
    downloadBlob(assetsToExport[0].blob, assetsToExport[0].filename)
  } else {
    try {
      const content = await zip.generateAsync({ type: 'blob' })
      downloadBlob(content, `assets_${Date.now()}.zip`)
    } catch (error) {
      console.error('Failed to generate ZIP', error)
      toast.show('Failed to generate ZIP archive')
    }
  }
}
</script>

<template>
  <Section :collapsed="!selectedNode">
    <div class="tp-assets-content">
      <!-- Preview Area -->
      <div
        class="tp-assets-preview-container"
        @mouseenter="isHovering = true"
        @mouseleave="isHovering = false"
      >
        <div class="tp-assets-preview-box">
          <div v-if="selectedNode" class="tp-assets-preview-title">{{ selectedNode.name }}</div>
          <div class="tp-assets-preview-image-wrap">
            <img
              v-if="previewUrl"
              :src="previewUrl"
              alt="Preview"
              class="tp-assets-preview-image"
            />
            <div v-else class="tp-assets-preview-placeholder">No selection</div>
          </div>
          <Transition name="tp-fade">
            <button v-if="isHovering" class="tp-assets-add-btn" @click="addToAssets">
              Add to Assets
            </button>
          </Transition>
        </div>
      </div>

      <!-- Settings -->
      <div class="tp-assets-settings">
        <div class="tp-assets-setting-row">
          <span class="tp-assets-setting-label">Format</span>
          <SegmentedControl
            class="tp-assets-format-control"
            :options="formatOptions"
            v-model="exportFormat"
          />
        </div>

        <div class="tp-assets-setting-row">
          <span class="tp-assets-setting-label">Scale</span>
          <div class="tp-assets-scales">
            <button
              v-for="option in scaleOptions"
              :key="option.value"
              class="tp-assets-scale-btn"
              :class="{ 'tp-assets-scale-btn-active': exportScales === option.value }"
              @click="toggleScale(option.value)"
            >
              <Check v-if="exportScales === option.value" class="tp-assets-scale-check" />
              {{ option.label }}
            </button>
          </div>
        </div>

        <div class="tp-assets-setting-row">
          <span class="tp-assets-setting-label">Compress Image</span>
          <div class="tp-switch-container">
            <label class="tp-switch">
              <input type="checkbox" v-model="compressImage" />
              <span class="tp-switch-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <div class="tp-assets-actions">
        <button class="tp-assets-export-all-btn" @click="exportAll">Export All</button>
      </div>

      <!-- Exportable Assets List -->
      <div class="tp-assets-list-section">
        <div class="tp-assets-list-header">Exportable Assets</div>
        <div class="tp-assets-list">
          <div v-for="asset in exportableAssets" :key="asset.id" class="tp-assets-item">
            <div class="tp-assets-item-left">
              <div class="tp-assets-item-thumb">
                <img v-if="asset.preview" :src="asset.preview" alt="" />
              </div>
              <span class="tp-assets-item-name tp-ellipsis">{{ asset.name }}</span>
            </div>
            <IconButton @click="exportAsset(asset.node, exportFormat, exportScales)">
              <Download />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  </Section>
</template>

<style scoped>
.tp-assets-content {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tp-assets-preview-container {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-medium);
  padding: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

.tp-assets-preview-box {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.tp-assets-preview-title {
  align-self: flex-start;
  font-size: 10px;
  color: var(--color-text-tertiary, #888);
  margin-bottom: 4px;
}

.tp-assets-preview-image-wrap {
  width: 100%;
  min-height: 120px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #000;
  border-radius: 4px;
  overflow: hidden;
}

.tp-assets-preview-image {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
}

.tp-assets-preview-placeholder {
  color: var(--color-text-tertiary);
}

.tp-assets-add-btn {
  position: absolute;
  bottom: 24px;
  background: #fff;
  color: #000;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  cursor: pointer;
}

.tp-fade-enter-active,
.tp-fade-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}

.tp-fade-enter-from,
.tp-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.tp-assets-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tp-assets-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tp-assets-setting-label {
  font-size: 12px;
  color: var(--color-text);
}

.tp-assets-format-control {
  transform: scale(0.9);
  transform-origin: right center;
}

.tp-assets-scales {
  display: flex;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-medium);
  padding: 2px;
}

.tp-assets-scale-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.tp-assets-scale-btn-active {
  background: var(--color-bg-tertiary, rgba(255, 255, 255, 0.1));
  color: var(--color-text);
}

.tp-assets-scale-check {
  width: 12px;
  height: 12px;
}

.tp-switch-container {
  display: flex;
  align-items: center;
}

.tp-switch {
  position: relative;
  display: inline-block;
  width: 32px;
  height: 18px;
}

.tp-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.tp-switch-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: var(--color-bg-tertiary, #444);
  transition: 0.2s;
  border-radius: 18px;
}

.tp-switch-slider:before {
  position: absolute;
  content: '';
  height: 14px;
  width: 14px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: 0.2s;
  border-radius: 50%;
}

input:checked + .tp-switch-slider {
  background-color: var(--color-primary, #18a0fb);
}

input:checked + .tp-switch-slider:before {
  transform: translateX(14px);
}

.tp-assets-export-all-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-text);
  color: var(--color-bg);
  padding: 10px;
  border-radius: var(--radius-medium);
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
}

.tp-assets-list-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}

.tp-assets-list-header {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
}

.tp-assets-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tp-assets-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.tp-assets-item-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.tp-assets-item-thumb {
  width: 36px;
  height: 36px;
  background: var(--color-bg-secondary);
  border-radius: 4px;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.tp-assets-item-thumb img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.tp-assets-item-name {
  font-size: 12px;
  color: var(--color-text);
}
</style>
