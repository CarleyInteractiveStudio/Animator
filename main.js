// --- WebGL Rendering Logic (from previous step) ---
function initWebGL(canvas) {
    const gl = canvas.getContext('webgl');
    if (!gl) {
        console.error('WebGL not supported');
        return null;
    }

    const vertexShaderSource = `
        attribute vec2 a_position;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
    `;

    const fragmentShaderSource = `
        void main() {
            gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // White
        }
    `;

    function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    function createProgram(gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        return program;
    }

    const program = createProgram(gl, vertexShader, fragmentShader);

    const positions = [0.0, 0.5, -0.5, -0.5, 0.5, -0.5];
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    return { gl, program, positionBuffer };
}

function renderWebGL(webglContext, canvas) {
    const { gl, program, positionBuffer } = webglContext;

    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    gl.clearColor(0.13, 0.13, 0.13, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
}

// --- Utility Functions ---
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// --- Windowing System Logic ---
window.onload = () => {
    const appContainer = document.getElementById('app-container');
    let webglContext = null;
    let maxZIndex = 10;

    const panelConfig = [
        { id: 'panel-jerarquia', title: 'Jerarquía', x: 20, y: 20, width: 250, height: 400 },
        { id: 'panel-visor', title: 'Visor 3D', x: 300, y: 20, width: 600, height: 500 },
        { id: 'panel-inspector', title: 'Inspector', x: 930, y: 20, width: 250, height: 400 }
    ];

    panelConfig.forEach(config => {
        const panel = document.createElement('div');
        panel.id = config.id;
        panel.className = 'panel';
        panel.style.left = `${config.x}px`;
        panel.style.top = `${config.y}px`;
        panel.style.width = `${config.width}px`;
        panel.style.height = `${config.height}px`;

        const titleBar = document.createElement('div');
        titleBar.className = 'panel-title';
        titleBar.textContent = config.title;

        // Drag logic
        titleBar.addEventListener('mousedown', (e) => {
            e.preventDefault();

            // Bring panel to front
            maxZIndex++;
            panel.style.zIndex = maxZIndex;

            let startX = e.clientX;
            let startY = e.clientY;
            let startLeft = panel.offsetLeft;
            let startTop = panel.offsetTop;

            function onMouseMove(e) {
                let newLeft = startLeft + e.clientX - startX;
                let newTop = startTop + e.clientY - startY;

                // Clamp position to keep the title bar within the viewport
                const maxLeft = appContainer.clientWidth - panel.offsetWidth;
                const maxTop = appContainer.clientHeight - titleBar.offsetHeight;

                newLeft = clamp(newLeft, 0, maxLeft);
                newTop = clamp(newTop, 0, maxTop);

                panel.style.left = `${newLeft}px`;
                panel.style.top = `${newTop}px`;
            }

            function onMouseUp() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        const contentArea = document.createElement('div');
        contentArea.className = 'panel-content';

        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';

        // Resize logic
        resizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Prevent drag logic from firing
            let startX = e.clientX;
            let startY = e.clientY;
            let startWidth = panel.offsetWidth;
            let startHeight = panel.offsetHeight;

            function onMouseMove(e) {
                let newWidth = startWidth + e.clientX - startX;
                let newHeight = startHeight + e.clientY - startY;

                // Clamp size
                const minWidth = 150;
                const minHeight = 100;
                const maxWidth = appContainer.clientWidth - panel.offsetLeft;
                const maxHeight = appContainer.clientHeight - panel.offsetTop;

                newWidth = clamp(newWidth, minWidth, maxWidth);
                newHeight = clamp(newHeight, minHeight, maxHeight);

                panel.style.width = `${newWidth}px`;
                panel.style.height = `${newHeight}px`;
            }

            function onMouseUp() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        panel.appendChild(titleBar);
        panel.appendChild(contentArea);
        panel.appendChild(resizeHandle);
        appContainer.appendChild(panel);

        if (config.id === 'panel-visor') {
            const canvas = document.createElement('canvas');
            contentArea.appendChild(canvas);
            webglContext = initWebGL(canvas);
        }
    });

    function mainLoop() {
        if (webglContext) {
            const visorPanel = document.getElementById('panel-visor');
            const canvas = visorPanel.querySelector('canvas');
            renderWebGL(webglContext, canvas);
        }
        requestAnimationFrame(mainLoop);
    }

    requestAnimationFrame(mainLoop);
};
