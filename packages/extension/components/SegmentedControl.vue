<script setup lang="ts" generic="T extends string | number | boolean">
import type { Component } from 'vue'

import { watch } from 'vue'

export interface SegmentedControlOption<T> {
  label: string
  value: T
  icon?: Component
  tooltip?: string
}

const props = defineProps<{
  options: SegmentedControlOption<T>[]
  name?: string
}>()

const model = defineModel<T>()

const name = props.name || `segmented-control-${Math.random().toString(36).slice(2)}`

watch(
  () => props.options,
  (list) => {
    if (model.value == null) {
      return
    }

    if (!list.some((option) => option.value === model.value)) {
      model.value = undefined
    }
  },
  { deep: true }
)
</script>

<template>
  <div class="tp-segmented-control">
    <div
      v-for="option in options"
      :key="String(option.value)"
      class="tp-segmented-control-option"
      :class="{ 'tp-segmented-control-option-active': model === option.value }"
      @click="model = option.value"
    >
      <input
        type="radio"
        class="tp-segmented-control-input"
        :name="name"
        :id="`${name}-${option.value}`"
        :value="option.value"
        :checked="model === option.value"
        @change="model = option.value"
        :data-tooltip="option.tooltip || option.label"
        data-tooltip-type="text"
      />
      <div class="tp-segmented-control-content">
        <span v-if="option.icon" class="tp-segmented-control-icon" aria-hidden="true">
          <component class="tp-segmented-control-icon-content" :is="option.icon" />
        </span>
        <label :for="`${name}-${option.value}`" class="tp-segmented-control-label">
          {{ option.label }}
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tp-segmented-control {
  --radio-icon-size: 14px;
  display: inline-flex;
  padding: 2px;
  border-radius: var(--radius-medium);
  background-color: var(--color-bg-secondary);
}

.tp-segmented-control-option {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.tp-segmented-control-option-active {
  background-color: var(--color-bg);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.tp-segmented-control-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.tp-segmented-control-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 12px;
  z-index: 1;
}

.tp-segmented-control-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  width: var(--radio-icon-size);
  height: var(--radio-icon-size);
}

.tp-segmented-control-icon-content {
  width: 100%;
  height: 100%;
}

.tp-segmented-control-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-secondary);
  user-select: none;
  white-space: nowrap;
  cursor: pointer;
}

.tp-segmented-control-option-active .tp-segmented-control-label {
  color: var(--color-text);
}

.tp-segmented-control-option-active .tp-segmented-control-icon {
  color: var(--color-text);
}
</style>
