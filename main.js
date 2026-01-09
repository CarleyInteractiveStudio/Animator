window.onload = () => {
    const visorPanel = document.getElementById('panel-visor');

    if (!visorPanel) {
        console.error('Visor panel not found');
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = visorPanel.clientWidth;
    canvas.height = visorPanel.clientHeight;
    visorPanel.appendChild(canvas);

    const gl = canvas.getContext('webgl');

    if (!gl) {
        console.error('WebGL not supported');
        return;
    }

    // Shaders
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

    // Shader compilation
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

    // Program linking
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

    // Vertex data and buffer
    const positions = [
        0.0,  0.5,
       -0.5, -0.5,
        0.5, -0.5,
    ];
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    // Render loop
    function render() {
        // Resize canvas and viewport
        if (canvas.width !== visorPanel.clientWidth || canvas.height !== visorPanel.clientHeight) {
            canvas.width = visorPanel.clientWidth;
            canvas.height = visorPanel.clientHeight;
            gl.viewport(0, 0, canvas.width, canvas.height);
        }

        // Clear the canvas
        gl.clearColor(0.13, 0.13, 0.13, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Use the program
        gl.useProgram(program);

        // Set up the position attribute
        const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

        // Draw the triangle
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        // Request next frame
        requestAnimationFrame(render);
    }

    // Start rendering
    requestAnimationFrame(render);
};
