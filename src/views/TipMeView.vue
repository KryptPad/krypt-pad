<template>
    <v-main>
        <v-container>
            <h1>Help Support Krypt Pad</h1>
            <p>Show your appreciation by using any of the methods below to show support. Thanks!</p>

            <v-btn class="mb-5" color="primary" @click="openTipLink">Tip me on ko-fi</v-btn>

            <h2>Other ways to support Krypt Pad</h2>

            <div class="d-flex" style="gap: 1rem">
                <!-- BTC -->
                <v-card class="text-center">
                    <v-card-title>
                        <div><v-icon icon="mdi-send" color="primary"></v-icon>&nbsp;Bitcoin</div>
                    </v-card-title>

                    <img :src="qrBTC" style="height: 10rem" />
                </v-card>
            </div>
        </v-container>
    </v-main>
</template>

<script setup lang="ts">
import { Ref, ref } from 'vue'
import QRCode from 'qrcode'

const qrBTC = ref<string>()

/**
 * Generates a QR code from text
 * @param {String} text
 */
const generateQR = async (text: string, refVar: Ref<string | undefined>) => {
    try {
        refVar.value = await QRCode.toDataURL(text)
    } catch (err) {
        console.error(err)
    }
}

function openTipLink() {
    window.open('https://ko-fi.com/neptunecentury', '_blank')
}

// Generate QR codes
generateQR('bc1q5c4gjd33py30sg9n9jcvgevuxu2fcl3r4j7yuq', qrBTC)
</script>
