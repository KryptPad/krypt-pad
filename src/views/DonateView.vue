<template>
    <v-main>
        <v-container>
            <h1>Donate</h1>
            <p>Feel like sending me a tip? Use the QR code(s) below to send some crypto. Thanks!</p>

            <div class="d-flex justify-center mt-5">
                <div class="text-center">
                    <div><v-icon icon="mdi-currency-btc" color="yellow"></v-icon> BTC</div>

                    <img :src="btcQRCode">
                </div>
            </div>

        </v-container>

    </v-main>
</template>

<script setup>

import { ref } from 'vue';
import QRCode from 'qrcode';

const btcQRCode = ref();

const generateQR = async text => {
    try {
        btcQRCode.value = await QRCode.toDataURL(text);

    } catch (err) {
        console.error(err)
    }
}

// BTC
generateQR('bc1q5c4gjd33py30sg9n9jcvgevuxu2fcl3r4j7yuq');
</script>