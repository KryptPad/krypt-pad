<template>
    <div class="title-bar d-flex align-center w-100" :class="{ 'focused': isFocused }">
        <span class="ml-3">{{ title }}</span>

        <div class="ml-auto">
            <button class="title-bar-button title-bar-button-minimize" type="button" @click="minimize"><v-icon
                    icon="mdi-window-minimize" /></button>
            <button class="title-bar-button title-bar-button-maximize-restore" type="button" @click="toggleMaximizeRestore">
                <v-icon :icon="isMaximized ? 'mdi-window-restore' : 'mdi-window-maximize'" />
            </button>
            <button class="title-bar-button title-bar-button-close" type="button" @click="close"><v-icon
                    icon="mdi-window-close" /></button>
        </div>

    </div>
</template>

<script setup>

import { ref, onMounted } from 'vue';

// Define our reactive properties
const isMaximized = ref(false);
const isFocused = ref(true);

defineProps({
    title: { type: String, default: "Krypt Pad Lite" }
});

// Window button handlers
function minimize() {
    window.electronAPI.minimize();
}

function toggleMaximizeRestore() {
    window.electronAPI.toggleMaximizeRestore();
}

function close() {
    window.electronAPI.close();
}

// Register any callback we need.
// Register unmaximize callback
window.electronAPI.onUnmaximize(() => {
    isMaximized.value = false;
});

// Register maximized callback
window.electronAPI.onMaximize(() => {
    isMaximized.value = true;
});

window.electronAPI.onBlur(() => {
    isFocused.value = false;
});

window.electronAPI.onFocus(() => {
    isFocused.value = true;
});

// Component hooks
onMounted(() => {
    isMaximized.value = window.electronAPI.getIsMaximized();
});

</script>

<style lang="scss" scoped>
$title-bar-height: 30px;
$dark-title-bar-blur-color: rgb(var(--v-theme-on-surface-variant));
$dark-title-bar-focus-color: rgb(77, 77, 77);
$light-title-bar-blur-color: rgb(var(--v-theme-on-surface-variant));
$light-title-bar-focus-color: rgb(202, 202, 202);

$dark-button-hover-color: #555;
$light-button-hover-color: #cccccc;
$button-hover-close-color: #db5252;

$transition: background-color 200ms ease-in-out;

.title-bar {
    height: $title-bar-height;
    -webkit-user-select: none;
    webkit-user-select: none;
    -webkit-app-region: drag;
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
    font-size: .9rem;
    height: $title-bar-height;
}

.v-theme--dark .title-bar {
    background-color: $dark-title-bar-blur-color;
}

.v-theme--light .title-bar {
    background-color: $light-title-bar-blur-color;
}

.v-theme--dark .title-bar.focused {
    background-color: $dark-title-bar-focus-color;
}

.v-theme--light .title-bar.focused {
    background-color: $light-title-bar-focus-color;
}
</style>