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

        #define MAX_POINT_LIGHTS 4
        #define MAX_SPOT_LIGHTS 4

        struct PointLight {
            vec3 position;
            vec3 color;
            float constant;
            float linear;
            float quadratic;
        };

        struct SpotLight {
            vec3 position;
            vec3 direction;
            vec3 color;
            float cutOff;
            float outerCutOff;
            float constant;
            float linear;
            float quadratic;
        };

        varying vec3 v_normal;
        varying vec3 v_worldPosition;
        varying vec2 v_texCoord;
        varying vec4 v_lightSpacePosition;

        uniform vec3 u_lightDirection; // For Directional Light
        uniform vec3 u_viewPosition;
        uniform vec3 u_color;
        uniform float u_shininess;
        uniform sampler2D u_sampler;
        uniform bool u_useTexture;
        uniform sampler2D u_shadowMap;
        uniform bool u_isUnlit;
        uniform vec2 u_shadowMapTexelSize;

        uniform PointLight u_pointLights[MAX_POINT_LIGHTS];
        uniform int u_numPointLights;

        uniform SpotLight u_spotLights[MAX_SPOT_LIGHTS];
        uniform int u_numSpotLights;

        float calculateShadow() {
            vec3 projCoords = v_lightSpacePosition.xyz / v_lightSpacePosition.w;
            projCoords = projCoords * 0.5 + 0.5;
            if (projCoords.z > 1.0) return 0.0;

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

        vec3 calcDirLight(vec3 normal, vec3 viewDir, vec4 baseColor) {
            vec3 lightDir = normalize(u_lightDirection);

            // Diffuse
            float diff = max(dot(normal, lightDir), 0.0);
            vec3 diffuse = diff * baseColor.rgb;

            // Specular
            vec3 reflectDir = reflect(-lightDir, normal);
            float spec = pow(max(dot(viewDir, reflectDir), 0.0), u_shininess);
            vec3 specular = 0.8 * spec * vec3(1.0, 1.0, 1.0);

            // Shadow
            float shadow = calculateShadow();

            return (1.0 - shadow) * (diffuse + specular);
        }

        vec3 calcPointLight(PointLight light, vec3 normal, vec3 fragPos, vec3 viewDir, vec4 baseColor) {
            vec3 lightDir = normalize(light.position - fragPos);

            // Diffuse
            float diff = max(dot(normal, lightDir), 0.0);
            vec3 diffuse = diff * light.color * baseColor.rgb;

            // Specular
            vec3 reflectDir = reflect(-lightDir, normal);
            float spec = pow(max(dot(viewDir, reflectDir), 0.0), u_shininess);
            vec3 specular = 0.8 * spec * light.color;

            // Attenuation
            float dist = length(light.position - fragPos);
            float attenuation = 1.0 / (light.constant + light.linear * dist + light.quadratic * (dist * dist));

            diffuse *= attenuation;
            specular *= attenuation;

            return (diffuse + specular);
        }

        vec3 calcSpotLight(SpotLight light, vec3 normal, vec3 fragPos, vec3 viewDir, vec4 baseColor) {
            vec3 lightDir = normalize(light.position - fragPos);

            // Spotlight intensity
            float theta = dot(lightDir, normalize(-light.direction));
            float epsilon = light.cutOff - light.outerCutOff;
            float intensity = clamp((theta - light.outerCutOff) / epsilon, 0.0, 1.0);

            if(intensity > 0.0) {
                // Diffuse
                float diff = max(dot(normal, lightDir), 0.0);
                vec3 diffuse = diff * light.color * baseColor.rgb;

                // Specular
                vec3 reflectDir = reflect(-lightDir, normal);
                float spec = pow(max(dot(viewDir, reflectDir), 0.0), u_shininess);
                vec3 specular = 0.8 * spec * light.color;

                // Attenuation
                float dist = length(light.position - fragPos);
                float attenuation = 1.0 / (light.constant + light.linear * dist + light.quadratic * (dist * dist));

                diffuse *= attenuation * intensity;
                specular *= attenuation * intensity;

                return (diffuse + specular);
            }
            return vec3(0.0, 0.0, 0.0);
        }


        void main() {
            vec4 baseColor = u_useTexture ? texture2D(u_sampler, v_texCoord) : vec4(u_color, 1.0);

            if (u_isUnlit) {
                gl_FragColor = baseColor;
                return;
            }

            vec3 normal = normalize(v_normal);
            vec3 viewDir = normalize(u_viewPosition - v_worldPosition);

            // Ambient (global)
            float ambientStrength = 0.15;
            vec3 ambient = ambientStrength * baseColor.rgb;

            // Directional Light
            vec3 result = calcDirLight(normal, viewDir, baseColor);

            // Point Lights
            for (int i = 0; i < MAX_POINT_LIGHTS; i++) {
                if (i < u_numPointLights) {
                    result += calcPointLight(u_pointLights[i], normal, v_worldPosition, viewDir, baseColor);
                }
            }

            // Spot Lights
            for (int i = 0; i < MAX_SPOT_LIGHTS; i++) {
                if (i < u_numSpotLights) {
                    result += calcSpotLight(u_spotLights[i], normal, v_worldPosition, viewDir, baseColor);
                }
            }

            gl_FragColor = vec4(ambient + result, baseColor.a);
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
            numPointLights: gl.getUniformLocation(sceneProgram, 'u_numPointLights'),
            pointLights: [],
            numSpotLights: gl.getUniformLocation(sceneProgram, 'u_numSpotLights'),
            spotLights: [],
        },
    };

    for (let i = 0; i < 4; i++) { // MAX_POINT_LIGHTS = 4
        sceneProgramInfo.uniformLocations.pointLights.push({
            position: gl.getUniformLocation(sceneProgram, `u_pointLights[${i}].position`),
            color: gl.getUniformLocation(sceneProgram, `u_pointLights[${i}].color`),
            constant: gl.getUniformLocation(sceneProgram, `u_pointLights[${i}].constant`),
            linear: gl.getUniformLocation(sceneProgram, `u_pointLights[${i}].linear`),
            quadratic: gl.getUniformLocation(sceneProgram, `u_pointLights[${i}].quadratic`),
        });
    }

    for (let i = 0; i < 4; i++) { // MAX_SPOT_LIGHTS = 4
        sceneProgramInfo.uniformLocations.spotLights.push({
            position: gl.getUniformLocation(sceneProgram, `u_spotLights[${i}].position`),
            direction: gl.getUniformLocation(sceneProgram, `u_spotLights[${i}].direction`),
            color: gl.getUniformLocation(sceneProgram, `u_spotLights[${i}].color`),
            cutOff: gl.getUniformLocation(sceneProgram, `u_spotLights[${i}].cutOff`),
            outerCutOff: gl.getUniformLocation(sceneProgram, `u_spotLights[${i}].outerCutOff`),
            constant: gl.getUniformLocation(sceneProgram, `u_spotLights[${i}].constant`),
            linear: gl.getUniformLocation(sceneProgram, `u_spotLights[${i}].linear`),
            quadratic: gl.getUniformLocation(sceneProgram, `u_spotLights[${i}].quadratic`),
        });
    }

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

    // --- Picking Shader ---
    const pickingVertexSource = `
        attribute vec4 a_position;
        uniform mat4 u_projectionMatrix;
        uniform mat4 u_viewMatrix;
        uniform mat4 u_modelMatrix;

        void main() {
            gl_Position = u_projectionMatrix * u_viewMatrix * u_modelMatrix * a_position;
        }
    `;
    const pickingFragmentSource = `
        precision mediump float;
        uniform vec4 u_idColor;

        void main() {
            gl_FragColor = u_idColor;
        }
    `;
    const pickingProgram = createProgram(gl, pickingVertexSource, pickingFragmentSource);
    const pickingProgramInfo = {
        program: pickingProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(pickingProgram, 'a_position'),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(pickingProgram, 'u_projectionMatrix'),
            viewMatrix: gl.getUniformLocation(pickingProgram, 'u_viewMatrix'),
            modelMatrix: gl.getUniformLocation(pickingProgram, 'u_modelMatrix'),
            idColor: gl.getUniformLocation(pickingProgram, 'u_idColor'),
        },
    };

    // --- Picking Framebuffer ---
    const pickingTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, pickingTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); // Start with 1x1, will resize
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    const pickingFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, pickingFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pickingTexture, 0);

    const pickingRenderbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, pickingRenderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, 1, 1);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, pickingRenderbuffer);


    gl.bindFramebuffer(gl.FRAMEBUFFER, null);


    return { gl, sceneProgramInfo, depthProgramInfo, depthFramebuffer, depthTexture, pickingProgramInfo, pickingFramebuffer, pickingTexture, pickingRenderbuffer };
}

function renderScene(gl, programInfo, scene, renderOptions) {
    const { isDepthPass = false, isPickingPass = false } = renderOptions;

    for (const gameObject of scene.gameObjects) {
        if (!gameObject.mesh || !gameObject.isSelectable) continue;

        const modelMatrix = gameObject.getModelMatrix();
        gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, modelMatrix);

        if (isPickingPass) {
            const r = ((gameObject.id + 1) & 0xFF) / 255.0;
            const g = (((gameObject.id + 1) >> 8) & 0xFF) / 255.0;
            const b = (((gameObject.id + 1) >> 16) & 0xFF) / 255.0;
            gl.uniform4f(programInfo.uniformLocations.idColor, r, g, b, 1.0);
        } else if (!isDepthPass) {
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

function resize(gl, webglContext) {
    const canvas = gl.canvas;
    const displayWidth  = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    if (canvas.width  !== displayWidth || canvas.height !== displayHeight) {
        canvas.width  = displayWidth;
        canvas.height = displayHeight;

        // Resize picking framebuffer attachments
        const { pickingTexture, pickingRenderbuffer } = webglContext;
        gl.bindTexture(gl.TEXTURE_2D, pickingTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, pickingRenderbuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, canvas.width, canvas.height);
    }
}

// Nueva función para el "picking"
export function pickObject(webglContext, canvas, scene, projectionMatrix, viewMatrix, x, y) {
    const { gl, pickingProgramInfo, pickingFramebuffer } = webglContext;

    gl.bindFramebuffer(gl.FRAMEBUFFER, pickingFramebuffer);
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(pickingProgramInfo.program);

    gl.uniformMatrix4fv(pickingProgramInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(pickingProgramInfo.uniformLocations.viewMatrix, false, viewMatrix);

    renderScene(gl, pickingProgramInfo, scene, { isPickingPass: true });

    const pixelData = new Uint8Array(4);
    // Leer el píxel en la coordenada del ratón.
    // WebGL tiene el origen (0,0) en la esquina inferior izquierda, pero el ratón lo tiene en la superior izquierda.
    gl.readPixels(x, canvas.height - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelData);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const id = (pixelData[0]) | (pixelData[1] << 8) | (pixelData[2] << 16);
    // Se resta 1 porque el ID 0 se confunde con el color de fondo (negro)
    return id - 1;
}

export function pickGizmoAxis(webglContext, canvas, gizmo, projectionMatrix, viewMatrix, x, y) {
    const { gl, pickingProgramInfo, pickingFramebuffer } = webglContext;

    gl.bindFramebuffer(gl.FRAMEBUFFER, pickingFramebuffer);
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(pickingProgramInfo.program);

    gl.uniformMatrix4fv(pickingProgramInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(pickingProgramInfo.uniformLocations.viewMatrix, false, viewMatrix);

    // Render only the gizmo in picking mode
    gizmo.render(gl, pickingProgramInfo, true);

    const pixelData = new Uint8Array(4);
    gl.readPixels(x, canvas.height - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelData);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const id = (pixelData[0]) | (pixelData[1] << 8) | (pixelData[2] << 16);
    return id; // Gizmo IDs are 1, 2, 3. 0 means nothing was picked.
}


export function renderWebGL(webglContext, canvas, scene, projectionMatrix, viewMatrix, cameraPosition, gizmo) {
    const { gl, sceneProgramInfo, depthProgramInfo, depthFramebuffer, depthTexture, pickingProgramInfo } = webglContext;

    resize(gl, webglContext);

    const lightSpaceMatrix = scene.directionalLight.getLightSpaceMatrix();

    // --- 1. Pase de Profundidad (Render desde la perspectiva de la luz) ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
    gl.viewport(0, 0, SHADOW_WIDTH, SHADOW_HEIGHT);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.cullFace(gl.FRONT);

    gl.useProgram(depthProgramInfo.program);
    gl.uniformMatrix4fv(depthProgramInfo.uniformLocations.lightSpaceMatrix, false, lightSpaceMatrix);
    renderScene(gl, depthProgramInfo, scene, { isDepthPass: true });

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.cullFace(gl.BACK);

    // --- 2. Pase de la Escena (Render normal desde la cámara) ---
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

    // --- Cargar datos de las Point Lights ---
    const numPointLights = scene.pointLights.length;
    gl.uniform1i(sceneProgramInfo.uniformLocations.numPointLights, numPointLights);

    for (let i = 0; i < numPointLights; i++) {
        const light = scene.pointLights[i];
        const locations = sceneProgramInfo.uniformLocations.pointLights[i];
        gl.uniform3fv(locations.position, light.position);
        gl.uniform3fv(locations.color, light.color);
        gl.uniform1f(locations.constant, light.constant);
        gl.uniform1f(locations.linear, light.linear);
        gl.uniform1f(locations.quadratic, light.quadratic);
    }

    // --- Cargar datos de las Spot Lights ---
    const numSpotLights = scene.spotLights.length;
    gl.uniform1i(sceneProgramInfo.uniformLocations.numSpotLights, numSpotLights);

    for (let i = 0; i < numSpotLights; i++) {
        const light = scene.spotLights[i];
        const locations = sceneProgramInfo.uniformLocations.spotLights[i];
        gl.uniform3fv(locations.position, light.position);
        gl.uniform3fv(locations.direction, light.direction);
        gl.uniform3fv(locations.color, light.color);
        gl.uniform1f(locations.cutOff, light.cutOff);
        gl.uniform1f(locations.outerCutOff, light.outerCutOff);
        gl.uniform1f(locations.constant, light.constant);
        gl.uniform1f(locations.linear, light.linear);
        gl.uniform1f(locations.quadratic, light.quadratic);
    }

    renderScene(gl, sceneProgramInfo, scene, false);

    // --- 3. Pase del Gizmo (Renderizar el gizmo encima de todo) ---
    if (gizmo && gizmo.isVisible) {
        gl.clear(gl.DEPTH_BUFFER_BIT); // Clear depth buffer to draw gizmo on top
        gl.useProgram(sceneProgramInfo.program); // Use the scene shader
        // We need to re-bind the main matrices as the program was switched
        gl.uniformMatrix4fv(sceneProgramInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(sceneProgramInfo.uniformLocations.viewMatrix, false, viewMatrix);
        gizmo.render(gl, sceneProgramInfo, false);
    }
}
