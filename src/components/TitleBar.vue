<template>
    <div class="title-bar d-flex align-center justify-space-between flex-nowrap w-100" :class="{ focused: isFocused }">
        <!-- <template v-if="$slots.icon"> -->
        <div v-if="platform !== 'darwin'" class="ml-2 mr-2 icon-wrapper">
            <slot name="icon"></slot>
        </div>
        <!-- </template> -->

        <div v-if="platform !== 'darwin'">{{ title }}</div>

        <div v-if="platform !== 'darwin'" class="mx-3 title-bar-menu">
            <slot name="menu"> </slot>
        </div>

        <div style="justify-self: center; margin: auto">
            <slot name="info"></slot>
        </div>

        <div v-if="platform !== 'darwin'" class="ml-auto">
            <button class="title-bar-button title-bar-button-minimize" type="button" @click="minimize"><v-icon icon="mdi-window-minimize" /></button>
            <button class="title-bar-button title-bar-button-maximize-restore" type="button" @click="toggleMaximizeRestore">
                <v-icon :icon="isMaximized ? 'mdi-window-restore' : 'mdi-window-maximize'" />
            </button>
            <button class="title-bar-button title-bar-button-close" type="button" @click="close"><v-icon icon="mdi-window-close" /></button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue'
import KryptPadAPI from '@/krypt-pad-api'

// Use the IPC renderer instance in the KP API
const kpAPI = inject<KryptPadAPI>('kpAPI')!
    const platform = inject<string>('platform')!

// Define our reactive properties
const isMaximized = ref(false)
const isFocused = ref(true)

defineProps({
    title: String
})

// Window button handlers
/**
 * Minimizes the window
 */
function minimize() {
    kpAPI.ipcBridge.minimize()
}

/**
 * Toggles the window maximize state
 */
function toggleMaximizeRestore() {
    kpAPI.ipcBridge.toggleMaximizeRestore()
}

/**
 * Closes the app
 */
function close() {
    kpAPI.ipcBridge.close()
}

// When the window is unmaximized, an event in the main process is raised that sends a message
// via IPC. This handler processes that message and raises a registered callback from the vue app.
kpAPI.ipcBridge.ipcRenderer.on('unmaximize', () => {
    isMaximized.value = false
})

// When the window is maximized, an event in the main process is raised that sends a message
// via IPC. This handler processes that message and raises a registered callback from the vue app.
kpAPI.ipcBridge.ipcRenderer.on('maximize', () => {
    isMaximized.value = true
})

kpAPI.ipcBridge.ipcRenderer.on('blur', () => {
    isFocused.value = false
})

kpAPI.ipcBridge.ipcRenderer.on('focus', () => {
    isFocused.value = true
})

// Component hooks
onMounted(async () => {
    isMaximized.value = await kpAPI.ipcBridge.getIsMaximized()
})
</script>

<style lang="scss">
$title-bar-height: 2rem;
$dark-title-bar-blur-color: rgb(var(--v-theme-surface));
$dark-title-bar-focus-color: rgb(var(--v-theme-surface));
$light-title-bar-blur-color: rgb(var(--v-theme-surface));
$light-title-bar-focus-color: rgb(var(--v-theme-surface));

$dark-button-hover-color: #555;
$light-button-hover-color: #cccccc;
$button-hover-close-color: #da2828;

$transition: background-color 200ms ease-in-out;

.title-bar {
    height: $title-bar-height;
    -webkit-user-select: none;
    user-select: none;
    -webkit-app-region: drag;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.title-bar .title-bar-menu {
    -webkit-app-region: no-drag;
}

.title-bar .icon-wrapper {
    line-height: $title-bar-height;
}

.title-bar .icon-wrapper > img {
    vertical-align: middle;
}

/* Title bar buttons */
.title-bar .title-bar-button {
    -webkit-app-region: no-drag;
    width: 3rem;
    cursor: default;
    transition: $transition;
}

.title-bar .title-bar-button:hover {
    -webkit-app-region: no-drag;
    width: 3rem;
}

.v-theme--dark .title-bar .title-bar-button:hover {
    background-color: $dark-button-hover-color;
}

.v-theme--light .title-bar .title-bar-button:hover {
    background-color: $light-button-hover-color;
}

.title-bar .title-bar-button.title-bar-button-close:hover {
    background-color: $button-hover-close-color;
}

.title-bar .title-bar-button i {
    font-size: 0.9rem;
    height: $title-bar-height;
}

.v-theme--dark .title-bar {
    background-color: $dark-title-bar-blur-color;
    color: rgb(var(--v-theme-on-surface));
}

.v-theme--light .title-bar {
    background-color: $light-title-bar-blur-color;
    color: rgb(var(--v-theme-on-surface));
}

.v-theme--dark .title-bar.focused {
    background-color: $dark-title-bar-focus-color;
}

.v-theme--light .title-bar.focused {
    background-color: $light-title-bar-focus-color;
}
</style>
