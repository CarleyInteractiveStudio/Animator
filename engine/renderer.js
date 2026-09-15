import { mat3 } from './math.js';

export function initWebGL(canvas) {
    const gl = canvas.getContext('webgl');
    if (!gl) {
        console.error('WebGL not supported');
        return null;
    }

    const vertexShaderSource = `
        attribute vec4 a_position;
        attribute vec3 a_normal;
        attribute vec4 a_color;

        uniform mat4 u_projectionMatrix;
        uniform mat4 u_viewMatrix;
        uniform mat4 u_modelMatrix;
        uniform mat3 u_normalMatrix;

        varying vec3 v_normal;
        varying vec4 v_color;

        void main() {
            gl_Position = u_projectionMatrix * u_viewMatrix * u_modelMatrix * a_position;
            v_normal = u_normalMatrix * a_normal;
            v_color = a_color;
        }
    `;

    const fragmentShaderSource = `
        precision mediump float;

        varying vec3 v_normal;
        varying vec4 v_color;

        uniform vec4 u_tintColor;
        uniform vec3 u_lightDirection;

        void main() {
            vec3 normal = normalize(v_normal);
            vec3 lightDir = normalize(u_lightDirection);

            float diff = max(dot(normal, lightDir), 0.0);
            float ambient = 0.35;
            float lighting = ambient + diff * 0.65;

            vec4 finalColor = v_color * u_tintColor;
            gl_FragColor = vec4(finalColor.rgb * lighting, finalColor.a);
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

    const programInfo = {
        program: program,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(program, 'a_position'),
            vertexNormal: gl.getAttribLocation(program, 'a_normal'),
            vertexColor: gl.getAttribLocation(program, 'a_color'),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(program, 'u_projectionMatrix'),
            viewMatrix: gl.getUniformLocation(program, 'u_viewMatrix'),
            modelMatrix: gl.getUniformLocation(program, 'u_modelMatrix'),
            normalMatrix: gl.getUniformLocation(program, 'u_normalMatrix'),
            tintColor: gl.getUniformLocation(program, 'u_tintColor'),
            lightDirection: gl.getUniformLocation(program, 'u_lightDirection'),
        },
    };

    return { gl, programInfo };
}

export function renderWebGL(webglContext, canvas, scene, projectionMatrix, viewMatrix, selectedGameObject = null, gizmo = null) {
    const { gl, programInfo } = webglContext;

    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    gl.clearColor(0.12, 0.12, 0.12, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(programInfo.program);

    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);
    gl.uniform3f(programInfo.uniformLocations.lightDirection, 0.5, 1.0, 0.7);

    for (const gameObject of scene.gameObjects) {
        if (!gameObject.mesh) {
            continue;
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, gameObject.mesh.vertexBuffer);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

        if (programInfo.attribLocations.vertexNormal !== -1 && gameObject.mesh.normalBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, gameObject.mesh.normalBuffer);
            gl.vertexAttribPointer(programInfo.attribLocations.vertexNormal, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);
        }

        if (programInfo.attribLocations.vertexColor !== -1 && gameObject.mesh.colorBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, gameObject.mesh.colorBuffer);
            gl.vertexAttribPointer(programInfo.attribLocations.vertexColor, 4, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gameObject.mesh.indexBuffer);

        const modelMatrix = gameObject.getModelMatrix();
        gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, modelMatrix);

        const normalMatrix = mat3.create();
        mat3.normalFromMat4(normalMatrix, modelMatrix);
        gl.uniformMatrix3fv(programInfo.uniformLocations.normalMatrix, false, normalMatrix);

        if (gameObject === selectedGameObject) {
            gl.uniform4f(programInfo.uniformLocations.tintColor, 1.0, 0.7, 0.3, 1.0);
        } else {
            gl.uniform4f(programInfo.uniformLocations.tintColor, 0.85, 0.85, 0.85, 1.0);
        }

        gl.drawElements(gl.TRIANGLES, gameObject.mesh.vertexCount, gl.UNSIGNED_SHORT, 0);
    }

    if (gizmo && selectedGameObject) {
        gizmo.render(gl, programInfo, selectedGameObject, viewMatrix, projectionMatrix);
    }
}
