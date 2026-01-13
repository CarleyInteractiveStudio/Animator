import { mat4 } from './math.js';

const SHADOW_WIDTH = 1024, SHADOW_HEIGHT = 1024;

export function initWebGL(canvas) {
    const gl = canvas.getContext('webgl');
    if (!gl) {
        console.error('WebGL not supported');
        return null;
    }

    const ext = gl.getExtension('WEBGL_depth_texture');
    if (!ext) {
        console.error('WEBGL_depth_texture extension not supported');
        return null;
    }

    // --- Shader para el pase de profundidad (Depth Pass) ---
    const depthVertexSource = `
        attribute vec4 a_position;
        uniform mat4 u_lightSpaceMatrix;
        uniform mat4 u_modelMatrix;

        void main() {
            gl_Position = u_lightSpaceMatrix * u_modelMatrix * a_position;
        }
    `;

    const depthFragmentSource = `
        precision mediump float;
        void main() {
            // No es necesario escribir color, solo se necesita el buffer de profundidad
        }
    `;

    // --- Shader para el pase de la escena (Scene Pass) ---
    const sceneVertexSource = `
        attribute vec4 a_position;
        attribute vec3 a_normal;
        attribute vec2 a_texCoord;

        uniform mat4 u_projectionMatrix;
        uniform mat4 u_viewMatrix;
        uniform mat4 u_modelMatrix;
        uniform mat4 u_normalMatrix;
        uniform mat4 u_lightSpaceMatrix;

        varying vec3 v_normal;
        varying vec3 v_worldPosition;
        varying vec2 v_texCoord;
        varying vec4 v_lightSpacePosition;

        void main() {
            vec4 worldPosition = u_modelMatrix * a_position;
            v_worldPosition = worldPosition.xyz;
            gl_Position = u_projectionMatrix * u_viewMatrix * worldPosition;
            v_normal = mat3(u_normalMatrix) * a_normal;
            v_texCoord = a_texCoord;
            v_lightSpacePosition = u_lightSpaceMatrix * worldPosition;
        }
    `;

    const sceneFragmentSource = `
        precision mediump float;

        varying vec3 v_normal;
        varying vec3 v_worldPosition;
        varying vec2 v_texCoord;
        varying vec4 v_lightSpacePosition;

        uniform vec3 u_lightDirection;
        uniform vec3 u_viewPosition;
        uniform vec3 u_color;
        uniform float u_shininess;
        uniform sampler2D u_sampler;
        uniform bool u_useTexture;
        uniform sampler2D u_shadowMap;
        uniform bool u_isUnlit;
        uniform vec2 u_shadowMapTexelSize;

        float calculateShadow() {
            vec3 projCoords = v_lightSpacePosition.xyz / v_lightSpacePosition.w;
            projCoords = projCoords * 0.5 + 0.5;

            if (projCoords.z > 1.0) {
                return 0.0;
            }

            vec3 normal = normalize(v_normal);
            vec3 lightDir = normalize(u_lightDirection);
            float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);

            float shadow = 0.0;
            for (int x = -1; x <= 1; ++x) {
                for (int y = -1; y <= 1; ++y) {
                    float pcfDepth = texture2D(u_shadowMap, projCoords.xy + vec2(x, y) * u_shadowMapTexelSize).r;
                    shadow += (projCoords.z - bias > pcfDepth) ? 1.0 : 0.0;
                }
            }
            shadow /= 9.0;

            return shadow;
        }

        void main() {
            vec4 baseColor = u_useTexture ? texture2D(u_sampler, v_texCoord) : vec4(u_color, 1.0);

            if (u_isUnlit) {
                gl_FragColor = baseColor;
                return;
            }

            float ambientStrength = 0.15;
            vec3 ambient = ambientStrength * baseColor.rgb;

            vec3 normal = normalize(v_normal);
            vec3 lightDir = normalize(u_lightDirection);
            float diff = max(dot(normal, lightDir), 0.0);
            vec3 diffuse = diff * baseColor.rgb;

            vec3 viewDir = normalize(u_viewPosition - v_worldPosition);
            vec3 reflectDir = reflect(-lightDir, normal);
            float spec = pow(max(dot(viewDir, reflectDir), 0.0), u_shininess);
            vec3 specular = 0.8 * spec * vec3(1.0, 1.0, 1.0);

            float shadow = calculateShadow();
            vec3 result = ambient + (1.0 - shadow) * (diffuse + specular);

            gl_FragColor = vec4(result, baseColor.a);
        }
    `;

    // --- Funciones de utilidad para Shaders y Programas ---
    function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Error al compilar shader:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    function createProgram(gl, vertexSource, fragmentSource) {
        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Error al enlazar programa:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        return program;
    }

    // --- Creación de programas ---
    const depthProgram = createProgram(gl, depthVertexSource, depthFragmentSource);
    const sceneProgram = createProgram(gl, sceneVertexSource, sceneFragmentSource);

    const depthProgramInfo = {
        program: depthProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(depthProgram, 'a_position'),
        },
        uniformLocations: {
            lightSpaceMatrix: gl.getUniformLocation(depthProgram, 'u_lightSpaceMatrix'),
            modelMatrix: gl.getUniformLocation(depthProgram, 'u_modelMatrix'),
        },
    };

    const sceneProgramInfo = {
        program: sceneProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(sceneProgram, 'a_position'),
            vertexNormal: gl.getAttribLocation(sceneProgram, 'a_normal'),
            textureCoord: gl.getAttribLocation(sceneProgram, 'a_texCoord'),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(sceneProgram, 'u_projectionMatrix'),
            viewMatrix: gl.getUniformLocation(sceneProgram, 'u_viewMatrix'),
            modelMatrix: gl.getUniformLocation(sceneProgram, 'u_modelMatrix'),
            normalMatrix: gl.getUniformLocation(sceneProgram, 'u_normalMatrix'),
            lightSpaceMatrix: gl.getUniformLocation(sceneProgram, 'u_lightSpaceMatrix'),
            lightDirection: gl.getUniformLocation(sceneProgram, 'u_lightDirection'),
            viewPosition: gl.getUniformLocation(sceneProgram, 'u_viewPosition'),
            shininess: gl.getUniformLocation(sceneProgram, 'u_shininess'),
            sampler: gl.getUniformLocation(sceneProgram, 'u_sampler'),
            color: gl.getUniformLocation(sceneProgram, 'u_color'),
            useTexture: gl.getUniformLocation(sceneProgram, 'u_useTexture'),
            shadowMap: gl.getUniformLocation(sceneProgram, 'u_shadowMap'),
            isUnlit: gl.getUniformLocation(sceneProgram, 'u_isUnlit'),
            shadowMapTexelSize: gl.getUniformLocation(sceneProgram, 'u_shadowMapTexelSize'),
        },
    };

    // --- Framebuffer para el mapa de sombras ---
    const depthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, SHADOW_WIDTH, SHADOW_HEIGHT, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const depthFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
        console.error('El framebuffer de profundidad no está completo:', status);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return { gl, sceneProgramInfo, depthProgramInfo, depthFramebuffer, depthTexture };
}

function renderScene(gl, programInfo, scene, isDepthPass, lightSpaceMatrix) {
    for (const gameObject of scene.gameObjects) {
        if (!gameObject.mesh) continue;

        const modelMatrix = gameObject.getModelMatrix();
        gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, modelMatrix);

        if (!isDepthPass) {
            gl.uniform1i(programInfo.uniformLocations.isUnlit, gameObject.material.isUnlit ? 1 : 0);
            gl.uniform1f(programInfo.uniformLocations.shininess, gameObject.material.shininess);
            if (gameObject.material.texture) {
                gameObject.material.texture.bind(0);
                gl.uniform1i(programInfo.uniformLocations.sampler, 0);
                gl.uniform1i(programInfo.uniformLocations.useTexture, 1);
            } else {
                gl.uniform1i(programInfo.uniformLocations.useTexture, 0);
                gl.uniform3fv(programInfo.uniformLocations.color, gameObject.material.color);
            }
            const normalMatrix = mat4.create();
            mat4.invert(normalMatrix, modelMatrix);
            mat4.transpose(normalMatrix, normalMatrix);
            gl.uniformMatrix4fv(programInfo.uniformLocations.normalMatrix, false, normalMatrix);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, gameObject.mesh.vertexBuffer);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

        if (!isDepthPass) {
            gl.bindBuffer(gl.ARRAY_BUFFER, gameObject.mesh.normalBuffer);
            gl.vertexAttribPointer(programInfo.attribLocations.vertexNormal, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);
            gl.bindBuffer(gl.ARRAY_BUFFER, gameObject.mesh.uvBuffer);
            gl.vertexAttribPointer(programInfo.attribLocations.textureCoord, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gameObject.mesh.indexBuffer);
        gl.drawElements(gl.TRIANGLES, gameObject.mesh.vertexCount, gl.UNSIGNED_SHORT, 0);
    }
}


export function renderWebGL(webglContext, canvas, scene, projectionMatrix, viewMatrix, cameraPosition) {
    const { gl, sceneProgramInfo, depthProgramInfo, depthFramebuffer, depthTexture } = webglContext;

    const lightSpaceMatrix = scene.directionalLight.getLightSpaceMatrix();

    // --- 1. Pase de Profundidad (Render desde la perspectiva de la luz) ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
    gl.viewport(0, 0, SHADOW_WIDTH, SHADOW_HEIGHT);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.cullFace(gl.FRONT);

    gl.useProgram(depthProgramInfo.program);
    gl.uniformMatrix4fv(depthProgramInfo.uniformLocations.lightSpaceMatrix, false, lightSpaceMatrix);
    renderScene(gl, depthProgramInfo, scene, true);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.cullFace(gl.BACK);

    // --- 2. Pase de la Escena (Render normal desde la cámara) ---
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0.13, 0.13, 0.13, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(sceneProgramInfo.program);

    gl.uniformMatrix4fv(sceneProgramInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(sceneProgramInfo.uniformLocations.viewMatrix, false, viewMatrix);
    gl.uniformMatrix4fv(sceneProgramInfo.uniformLocations.lightSpaceMatrix, false, lightSpaceMatrix);
    gl.uniform3fv(sceneProgramInfo.uniformLocations.viewPosition, cameraPosition);

    const lightDir = scene.directionalLight.position;
    const normalizedLightDir = new Float32Array(3);
    const len = Math.sqrt(lightDir[0]*lightDir[0] + lightDir[1]*lightDir[1] + lightDir[2]*lightDir[2]);
    normalizedLightDir[0] = lightDir[0] / len;
    normalizedLightDir[1] = lightDir[1] / len;
    normalizedLightDir[2] = lightDir[2] / len;
    gl.uniform3fv(sceneProgramInfo.uniformLocations.lightDirection, normalizedLightDir);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.uniform1i(sceneProgramInfo.uniformLocations.shadowMap, 1);

    gl.uniform2f(sceneProgramInfo.uniformLocations.shadowMapTexelSize, 1.0 / SHADOW_WIDTH, 1.0 / SHADOW_HEIGHT);

    renderScene(gl, sceneProgramInfo, scene, false);
}
