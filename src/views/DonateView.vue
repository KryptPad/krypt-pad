<template>
    <v-main>
        <v-container>
            <h1>Donate</h1>
            <p>Feel like sending me a tip? Use the QR code below to send any amount of <v-icon icon="mdi-currency-btc" color="yellow"></v-icon> BTC you'd like. Thanks!</p>
            
            <div>
                <img :src="qrCode">
            </div>
            
        </v-container>

    </v-main>
</template>

<script setup>

import { ref } from 'vue';
import QRCode from 'qrcode';

const qrCode = ref();

const generateQR = async text => {
    try {
        qrCode.value = await QRCode.toDataURL(text);

    } catch (err) {
        console.error(err)
    }
}

 generateQR('bc1q5c4gjd33py30sg9n9jcvgevuxu2fcl3r4j7yuq');
</script>