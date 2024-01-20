<template>
    <v-main>
        <v-container>
            <h1>Help Support Krypt Pad</h1>
            <p>Show your appreciation by using the QR code(s) below to send some crypto. Thanks!</p>

            <div class="d-flex justify-space-around mt-5">
                <!-- BTC -->
                <v-card class="text-center">
                    <v-card-title>
                        <div><v-icon icon="mdi-send" color="primary"></v-icon>&nbsp;BTC</div>
                    </v-card-title>

                    <img :src="qrBTC" style="height: 10rem;">
                    
                </v-card>

                <!-- OSMO -->
                <v-card class="text-center">
                    <v-card-title>
                        <div><v-icon icon="mdi-send" color="primary"></v-icon>&nbsp;OSMO</div>
                    </v-card-title>

                    <img :src="qrOSMO" style="height: 10rem;">
                    
                </v-card>
            </div>

        </v-container>

    </v-main>
</template>

<script setup lang="ts">

import { ref } from 'vue';
import QRCode from 'qrcode';

const qrBTC = ref(null);
const qrOSMO = ref(null);

/**
 * Generates a QR code from text
 * @param {String} text 
 */
const generateQR = async (text, refVar) => {
    try {
        refVar.value = await QRCode.toDataURL(text);

    } catch (err) {
        console.error(err)
    }

}

// Generate QR codes
generateQR('bc1q5c4gjd33py30sg9n9jcvgevuxu2fcl3r4j7yuq', qrBTC);
generateQR('osmo1khpun6zyp6sr505zp3utthejdy3v5duu99nm8z', qrOSMO);

</script>