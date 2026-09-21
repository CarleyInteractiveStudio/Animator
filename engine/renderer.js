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
        attribute vec2 a_texcoord;

        uniform mat4 u_projectionMatrix;
        uniform mat4 u_viewMatrix;
        uniform mat4 u_modelMatrix;
        uniform mat3 u_normalMatrix;

        varying vec3 v_normal;
        varying vec4 v_color;
        varying vec2 v_texcoord;
        varying vec3 v_worldPosition;

        void main() {
            vec4 worldPos = u_modelMatrix * a_position;
            v_worldPosition = worldPos.xyz;
            gl_Position = u_projectionMatrix * u_viewMatrix * worldPos;
            v_normal = u_normalMatrix * a_normal;
            v_color = a_color;
            v_texcoord = a_texcoord;
        }
    `;

    const fragmentShaderSource = `
        precision mediump float;

        varying vec3 v_normal;
        varying vec4 v_color;
        varying vec2 v_texcoord;
        varying vec3 v_worldPosition;

        uniform vec4 u_tintColor;
        uniform vec3 u_lightDirection;
        uniform bool u_isUnlit;

        // Texture and Procedural uniforms
        uniform int u_textureType; // 0: None, 1: Checkerboard, 2: Perlin Noise
        uniform float u_textureScale;
        uniform float u_metallic;
        uniform float u_roughness;

        // Procedural Checkerboard
        vec4 getCheckerboard(vec2 st, float scale) {
            vec2 chk = floor(st * scale);
            float f = mod(chk.x + chk.y, 2.0);
            return mix(vec4(0.1, 0.1, 0.1, 1.0), vec4(0.9, 0.9, 0.9, 1.0), f);
        }

        // Simple Hash & Noise for Procedural Noise
        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);

            return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                       mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }

        void main() {
            vec4 baseColor = v_color * u_tintColor;

            if (u_textureType == 1) { // Checkerboard
                vec2 uv = v_texcoord.x == 0.0 && v_texcoord.y == 0.0 ? v_worldPosition.xz : v_texcoord;
                baseColor *= getCheckerboard(uv, u_textureScale);
            } else if (u_textureType == 2) { // Noise
                vec2 uv = v_texcoord.x == 0.0 && v_texcoord.y == 0.0 ? v_worldPosition.xz : v_texcoord;
                float n = noise(uv * u_textureScale);
                baseColor *= vec4(vec3(n), 1.0);
            }

            if (u_isUnlit) {
                gl_FragColor = baseColor;
            } else {
                vec3 normal = normalize(v_normal);
                vec3 lightDir = normalize(u_lightDirection);

                float diff = max(dot(normal, lightDir), 0.0);
                float ambient = 0.35;

                // Specular highlight with roughness control
                vec3 viewDir = normalize(-v_worldPosition);
                vec3 halfDir = normalize(lightDir + viewDir);
                float specAngle = max(dot(normal, halfDir), 0.0);
                float specPow = max(1.0, (1.0 - u_roughness) * 64.0);
                float specular = pow(specAngle, specPow) * u_metallic;

                float lighting = ambient + diff * 0.65;
                vec3 finalRGB = baseColor.rgb * lighting + vec3(specular);

                gl_FragColor = vec4(finalRGB, baseColor.a);
            }
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
            vertexTexCoord: gl.getAttribLocation(program, 'a_texcoord'),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(program, 'u_projectionMatrix'),
            viewMatrix: gl.getUniformLocation(program, 'u_viewMatrix'),
            modelMatrix: gl.getUniformLocation(program, 'u_modelMatrix'),
            normalMatrix: gl.getUniformLocation(program, 'u_normalMatrix'),
            tintColor: gl.getUniformLocation(program, 'u_tintColor'),
            lightDirection: gl.getUniformLocation(program, 'u_lightDirection'),
            isUnlit: gl.getUniformLocation(program, 'u_isUnlit'),
            textureType: gl.getUniformLocation(program, 'u_textureType'),
            textureScale: gl.getUniformLocation(program, 'u_textureScale'),
            metallic: gl.getUniformLocation(program, 'u_metallic'),
            roughness: gl.getUniformLocation(program, 'u_roughness'),
        },
    };

    return { gl, programInfo };
}

export function renderWebGL(webglContext, canvas, scene, projectionMatrix, viewMatrix, selectedGameObject = null, gizmo = null, mode = 'object', tool = 'translate', brushRadius = 0.8) {
    const { gl, programInfo } = webglContext;

    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    // Allow CSS background (Skybox/Environment image/gradient) to show through canvas
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(programInfo.program);

    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);
    gl.uniform3f(programInfo.uniformLocations.lightDirection, 0.5, 1.0, 0.7);

    // Objects are lit by default
    gl.uniform1i(programInfo.uniformLocations.isUnlit, 0);

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

        // Material uniforms
        const mat = gameObject.material || { textureType: 0, textureScale: 5.0, metallic: 0.2, roughness: 0.5 };
        gl.uniform1i(programInfo.uniformLocations.textureType, mat.textureType || 0);
        gl.uniform1f(programInfo.uniformLocations.textureScale, mat.textureScale || 5.0);
        gl.uniform1f(programInfo.uniformLocations.metallic, mat.metallic !== undefined ? mat.metallic : 0.2);
        gl.uniform1f(programInfo.uniformLocations.roughness, mat.roughness !== undefined ? mat.roughness : 0.5);

        if (gameObject === selectedGameObject) {
            gl.uniform4f(programInfo.uniformLocations.tintColor, 1.0, 0.7, 0.3, 1.0);
        } else {
            gl.uniform4f(programInfo.uniformLocations.tintColor, 0.85, 0.85, 0.85, 1.0);
        }

        gl.drawElements(gl.TRIANGLES, gameObject.mesh.vertexCount, gl.UNSIGNED_SHORT, 0);
    }

    if (gizmo && selectedGameObject) {
        gl.uniform1i(programInfo.uniformLocations.isUnlit, 1);
        gl.uniform1i(programInfo.uniformLocations.textureType, 0);
        gizmo.render(gl, programInfo, selectedGameObject, viewMatrix, projectionMatrix, mode, tool, brushRadius);

        if (mode === 'model' && Engine && Engine.selectedSubElement) {
            gizmo.renderSubElementOverlay(gl, programInfo, selectedGameObject, Engine.selectedSubElement, viewMatrix, projectionMatrix);
        }
    }
}
