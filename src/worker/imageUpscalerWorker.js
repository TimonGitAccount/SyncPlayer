import * as tf from '@tensorflow/tfjs';
import * as UpscalerModule from 'upscalerjs';
const Upscaler = UpscalerModule.default;
import { x2, x3, x4, x8 } from '@upscalerjs/esrgan-medium';

onmessage = async function(event) {
    const { imageData, scale, width, height } = event.data;
    console.log('Worker empfing Daten:', { scale, width, height });

    try {
        let model;
        switch (scale) {
            case 2:
                model = x2;
                break;
            case 3:
                model = x3;
                break;
            case 4:
                model = x4;
                break;
            case 8:
                model = x8;
                break;
            default:
                model = x4;
                break;
        }
        console.log('Ausgewähltes Modell:', model ? model.name : 'default x4');

        const upscaler = new Upscaler({ model, tf }); // Verwende die umbenannte Konstante
        console.log('Upscaler initialisiert.');

        const upscaledTensor = await upscaler.upscale(imageData);
        console.log('Upscaling abgeschlossen (Tensor erhalten).');

        const canvas = new OffscreenCanvas(upscaledTensor.shape[1], upscaledTensor.shape[2]);
        const ctx = canvas.getContext('2d');

        if (ctx) {
            await tf.browser.toPixels(upscaledTensor, canvas);
            const upscaledImageData = canvas.toDataURL('image/png');
            postMessage({ success: true, upscaledImageData });
            console.log('Bilddaten zurückgesendet.');
        } else {
            postMessage({ success: false, error: 'Konnte keinen OffscreenCanvas-Kontext erstellen im Worker.' });
            console.error('Fehler im Worker: Konnte keinen OffscreenCanvas-Kontext erstellen.');
        }

        upscaledTensor.dispose();

    } catch (err) {
        postMessage({ success: false, error: err.message });
        console.error('Fehler im Worker:', err);
    }
};