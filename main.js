// --- WebGL Rendering Logic ---
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

// --- Panel Initialization ---
window.onload = () => {
    // Initialize Jerarquía Panel
    const jerarquiaContent = document.querySelector('#jerarquia-panel .panel-content');
    jerarquiaContent.innerHTML = '<p>Contenido de Jerarquía...</p>';

    // Initialize Visor 3D Panel
    const visorContent = document.querySelector('#visor-panel .panel-content');
    const canvas = document.createElement('canvas');
    visorContent.appendChild(canvas);
    const webglContext = initWebGL(canvas);
    function mainLoop() {
        if (webglContext) {
            renderWebGL(webglContext, canvas);
        }
        requestAnimationFrame(mainLoop);
    }
    requestAnimationFrame(mainLoop);

    // Initialize Inspector Panel
    const inspectorContent = document.querySelector('#inspector-panel .panel-content');
    inspectorContent.innerHTML = '<p>Contenido del Inspector...</p>';
};
