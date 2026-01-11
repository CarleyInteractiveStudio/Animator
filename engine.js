import { initWebGL, renderWebGL } from './engine/renderer.js';

let webglContext;
let canvas;

const Engine = {
    initialize: (canvasElement) => {
        canvas = canvasElement;
        webglContext = initWebGL(canvas);
        if (!webglContext) {
            console.error("Engine initialization failed.");
            return false;
        }
        return true;
    },
    start: () => {
        if (!webglContext) {
            console.error("Engine not initialized. Call Engine.initialize() first.");
            return;
        }

        function gameLoop() {
            renderWebGL(webglContext, canvas);
            requestAnimationFrame(gameLoop);
        }
        requestAnimationFrame(gameLoop);
    }
};

export default Engine;
