import { mat3, mat4, vec3 } from './math.js';

export function initWebGL(canvas) {
    const gl = canvas.getContext('webgl');
    if (!gl) {
        console.error('WebGL not supported');
        return null;
    }

    const depthTextureExt = gl.getExtension('WEBGL_depth_texture');

    // --- Depth Pass Program (for Shadow Map) ---
    const depthVertexShaderSource = `
        attribute vec4 a_position;
        uniform mat4 u_lightSpaceMatrix;
        uniform mat4 u_modelMatrix;

        void main() {
            gl_Position = u_lightSpaceMatrix * u_modelMatrix * a_position;
        }
    `;

    const depthFragmentShaderSource = `
        precision mediump float;
        void main() {
            gl_FragColor = vec4(1.0);
        }
    `;

    // --- Main Rendering Program (Multi-Light + PBR + Shadow Mapping + Specular) ---
    const vertexShaderSource = `
        attribute vec4 a_position;
        attribute vec3 a_normal;
        attribute vec4 a_color;

        uniform mat4 u_projectionMatrix;
        uniform mat4 u_viewMatrix;
        uniform mat4 u_modelMatrix;
        uniform mat3 u_normalMatrix;
        uniform mat4 u_lightSpaceMatrix;

        varying vec3 v_position;
        varying vec3 v_normal;
        varying vec4 v_color;
        varying vec4 v_shadowPos;

        void main() {
            vec4 worldPos = u_modelMatrix * a_position;
            v_position = worldPos.xyz;
            gl_Position = u_projectionMatrix * u_viewMatrix * worldPos;
            v_normal = u_normalMatrix * a_normal;
            v_color = a_color;
            v_shadowPos = u_lightSpaceMatrix * worldPos;
        }
    `;

    const fragmentShaderSource = `
        precision mediump float;

        varying vec3 v_position;
        varying vec3 v_normal;
        varying vec4 v_color;
        varying vec4 v_shadowPos;

        uniform vec4 u_materialColor;
        uniform float u_shininess;
        uniform float u_roughness;
        uniform float u_metallic;

        // Up to 4 Dynamic Lights
        uniform int u_numLights;
        uniform vec3 u_lightPos[4];
        uniform vec3 u_lightColor[4];
        uniform float u_lightIntensity[4];
        uniform int u_lightType[4]; // 0 = Sun/Directional, 1 = Point, 2 = Spot

        uniform vec3 u_viewPosition;
        uniform bool u_isUnlit;
        uniform bool u_isSelected;
        uniform bool u_hasShadowMap;
        uniform sampler2D u_shadowMap;

        float calculateShadow(vec4 shadowPos) {
            if (!u_hasShadowMap) return 0.0;

            vec3 projCoords = shadowPos.xyz / shadowPos.w;
            projCoords = projCoords * 0.5 + 0.5;

            if (projCoords.z > 1.0 || projCoords.x < 0.0 || projCoords.x > 1.0 || projCoords.y < 0.0 || projCoords.y > 1.0) {
                return 0.0;
            }

            float currentDepth = projCoords.z;
            float bias = 0.003;
            float shadow = 0.0;
            vec2 texelSize = vec2(1.0 / 1024.0);

            // Unrolled 3x3 PCF sampling
            shadow += currentDepth - bias > texture2D(u_shadowMap, projCoords.xy + vec2(-1.0, -1.0) * texelSize).r ? 1.0 : 0.0;
            shadow += currentDepth - bias > texture2D(u_shadowMap, projCoords.xy + vec2( 0.0, -1.0) * texelSize).r ? 1.0 : 0.0;
            shadow += currentDepth - bias > texture2D(u_shadowMap, projCoords.xy + vec2( 1.0, -1.0) * texelSize).r ? 1.0 : 0.0;
            shadow += currentDepth - bias > texture2D(u_shadowMap, projCoords.xy + vec2(-1.0,  0.0) * texelSize).r ? 1.0 : 0.0;
            shadow += currentDepth - bias > texture2D(u_shadowMap, projCoords.xy + vec2( 0.0,  0.0) * texelSize).r ? 1.0 : 0.0;
            shadow += currentDepth - bias > texture2D(u_shadowMap, projCoords.xy + vec2( 1.0,  0.0) * texelSize).r ? 1.0 : 0.0;
            shadow += currentDepth - bias > texture2D(u_shadowMap, projCoords.xy + vec2(-1.0,  1.0) * texelSize).r ? 1.0 : 0.0;
            shadow += currentDepth - bias > texture2D(u_shadowMap, projCoords.xy + vec2( 0.0,  1.0) * texelSize).r ? 1.0 : 0.0;
            shadow += currentDepth - bias > texture2D(u_shadowMap, projCoords.xy + vec2( 1.0,  1.0) * texelSize).r ? 1.0 : 0.0;

            return shadow / 9.0;
        }

        void main() {
            vec4 baseColor = v_color * u_materialColor;

            if (u_isUnlit) {
                if (u_isSelected) {
                    baseColor.rgb += vec3(0.12, 0.12, 0.12);
                }
                gl_FragColor = baseColor;
                return;
            }

            vec3 normal = normalize(v_normal);
            vec3 viewDir = normalize(u_viewPosition - v_position);
            float specPower = mix(128.0, 4.0, clamp(u_roughness, 0.05, 1.0));
            vec3 specularColor = mix(vec3(1.0), baseColor.rgb, u_metallic);

            float shadow = calculateShadow(v_shadowPos);

            vec3 totalDiffuse = vec3(0.0);
            vec3 totalSpecular = vec3(0.0);

            for (int i = 0; i < 4; i++) {
                if (i >= u_numLights) break;

                vec3 lightDir;
                float attenuation = 1.0;

                if (u_lightType[i] == 0) {
                    // Sun / Directional Light
                    lightDir = normalize(u_lightPos[i]);
                } else {
                    // Point Light or Spot Light
                    vec3 lightVec = u_lightPos[i] - v_position;
                    float dist = length(lightVec);
                    lightDir = normalize(lightVec);

                    // Attenuation formula
                    attenuation = 1.0 / (1.0 + 0.1 * dist + 0.03 * dist * dist);

                    if (u_lightType[i] == 2) {
                        // Spot Light cone cutoff (~35 degrees)
                        float spotCos = dot(-lightDir, vec3(0.0, -1.0, 0.0));
                        if (spotCos < 0.82) {
                            attenuation = 0.0;
                        }
                    }
                }

                float diff = max(dot(normal, lightDir), 0.0);
                vec3 halfDir = normalize(lightDir + viewDir);
                float specFactor = pow(max(dot(normal, halfDir), 0.0), specPower);

                float shadowFactor = (i == 0) ? shadow : 0.0;

                totalDiffuse += diff * baseColor.rgb * u_lightColor[i] * u_lightIntensity[i] * attenuation * (1.0 - shadowFactor * 0.75);
                totalSpecular += specFactor * specularColor * u_lightColor[i] * u_lightIntensity[i] * attenuation * (1.0 - u_roughness * 0.5) * (1.0 - shadowFactor * 0.75);
            }

            vec3 ambient = 0.25 * baseColor.rgb;
            vec3 finalRgb = ambient + totalDiffuse + totalSpecular;

            if (u_isSelected) {
                finalRgb += vec3(0.12, 0.1, 0.05);
            }

            gl_FragColor = vec4(finalRgb, baseColor.a);
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

    function createProgram(gl, vsSource, fsSource) {
        const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
        const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
        if (!vs || !fs) return null;
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        return program;
    }

    const depthProgram = createProgram(gl, depthVertexShaderSource, depthFragmentShaderSource);
    const mainProgram = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    if (!mainProgram) {
        console.error("Main shader program failed to compile");
        return null;
    }

    const shadowMapSize = 1024;
    let shadowFramebuffer = null;
    let shadowDepthTexture = null;

    if (depthTextureExt) {
        shadowFramebuffer = gl.createFramebuffer();
        shadowDepthTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, shadowDepthTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, shadowMapSize, shadowMapSize, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        const shadowColorTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, shadowColorTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, shadowMapSize, shadowMapSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowDepthTexture, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, shadowColorTexture, 0);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    const programInfo = {
        program: mainProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(mainProgram, 'a_position'),
            vertexNormal: gl.getAttribLocation(mainProgram, 'a_normal'),
            vertexColor: gl.getAttribLocation(mainProgram, 'a_color'),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(mainProgram, 'u_projectionMatrix'),
            viewMatrix: gl.getUniformLocation(mainProgram, 'u_viewMatrix'),
            modelMatrix: gl.getUniformLocation(mainProgram, 'u_modelMatrix'),
            normalMatrix: gl.getUniformLocation(mainProgram, 'u_normalMatrix'),
            lightSpaceMatrix: gl.getUniformLocation(mainProgram, 'u_lightSpaceMatrix'),
            materialColor: gl.getUniformLocation(mainProgram, 'u_materialColor'),
            shininess: gl.getUniformLocation(mainProgram, 'u_shininess'),
            roughness: gl.getUniformLocation(mainProgram, 'u_roughness'),
            metallic: gl.getUniformLocation(mainProgram, 'u_metallic'),
            numLights: gl.getUniformLocation(mainProgram, 'u_numLights'),
            lightPos: gl.getUniformLocation(mainProgram, 'u_lightPos'),
            lightColor: gl.getUniformLocation(mainProgram, 'u_lightColor'),
            lightIntensity: gl.getUniformLocation(mainProgram, 'u_lightIntensity'),
            lightType: gl.getUniformLocation(mainProgram, 'u_lightType'),
            viewPosition: gl.getUniformLocation(mainProgram, 'u_viewPosition'),
            isUnlit: gl.getUniformLocation(mainProgram, 'u_isUnlit'),
            isSelected: gl.getUniformLocation(mainProgram, 'u_isSelected'),
            hasShadowMap: gl.getUniformLocation(mainProgram, 'u_hasShadowMap'),
            shadowMap: gl.getUniformLocation(mainProgram, 'u_shadowMap'),
        },
    };

    const depthProgramInfo = depthProgram ? {
        program: depthProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(depthProgram, 'a_position'),
        },
        uniformLocations: {
            lightSpaceMatrix: gl.getUniformLocation(depthProgram, 'u_lightSpaceMatrix'),
            modelMatrix: gl.getUniformLocation(depthProgram, 'u_modelMatrix'),
        }
    } : null;

    return {
        gl,
        programInfo,
        depthProgramInfo,
        shadowFramebuffer,
        shadowDepthTexture,
        shadowMapSize,
        hasDepthExt: !!depthTextureExt
    };
}

export function renderWebGL(webglContext, canvas, scene, projectionMatrix, viewMatrix, selectedGameObject = null, gizmo = null, mode = 'object', tool = 'translate', brushRadius = 0.8, grid = null, camera = null) {
    const { gl, programInfo, depthProgramInfo, shadowFramebuffer, shadowDepthTexture, shadowMapSize, hasDepthExt } = webglContext;

    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }

    // Collect up to 4 lights in scene
    const lightPositions = [];
    const lightColors = [];
    const lightIntensities = [];
    const lightTypes = [];

    if (scene && scene.gameObjects) {
        for (const obj of scene.gameObjects) {
            if (obj.isLightObject && lightPositions.length < 12) { // 4 lights * 3 floats
                lightPositions.push(obj.transform.position[0], obj.transform.position[1], obj.transform.position[2]);
                const lightData = obj.lightData || { color: [1.0, 0.98, 0.92], intensity: 1.5, type: 'light-sun' };
                lightColors.push(lightData.color[0], lightData.color[1], lightData.color[2]);
                lightIntensities.push(lightData.intensity);

                let typeCode = 0; // Directional / Sun
                if (lightData.type === 'light-point') typeCode = 1;
                else if (lightData.type === 'light-spot') typeCode = 2;
                lightTypes.push(typeCode);
            }
        }
    }

    // Fallback default light if no light object is created
    if (lightPositions.length === 0) {
        lightPositions.push(0.6, 2.0, 0.8);
        lightColors.push(1.0, 0.98, 0.92);
        lightIntensities.push(1.0);
        lightTypes.push(0);
    }

    const numLights = lightPositions.length / 3;

    // Pad light arrays to exactly 4 lights (12 floats for vec3, 4 for float/int) to prevent WebGL uniform array bounds error
    const paddedLightPos = new Float32Array(12);
    const paddedLightColor = new Float32Array(12);
    const paddedLightIntensity = new Float32Array(4);
    const paddedLightType = new Int32Array(4);

    paddedLightPos.set(lightPositions);
    paddedLightColor.set(lightColors);
    paddedLightIntensity.set(lightIntensities);
    paddedLightType.set(lightTypes);

    // Light space matrix for shadow map based on primary light
    const lightProjectionMatrix = mat4.create();
    mat4.ortho(lightProjectionMatrix, -10, 10, -10, 10, 0.1, 40.0);

    const lightViewMatrix = mat4.create();
    const primaryLightPos = vec3.fromValues(lightPositions[0], lightPositions[1], lightPositions[2]);
    mat4.lookAt(lightViewMatrix, primaryLightPos, [0, 0, 0], [0, 1, 0]);

    const lightSpaceMatrix = mat4.create();
    mat4.multiply(lightSpaceMatrix, lightProjectionMatrix, lightViewMatrix);

    // Pass 1: Depth Pass
    if (hasDepthExt && shadowFramebuffer && depthProgramInfo) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);
        gl.viewport(0, 0, shadowMapSize, shadowMapSize);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.FRONT);

        gl.useProgram(depthProgramInfo.program);
        gl.uniformMatrix4fv(depthProgramInfo.uniformLocations.lightSpaceMatrix, false, lightSpaceMatrix);

        // Disable unused attrib arrays for clean depth pass
        if (programInfo.attribLocations.vertexNormal !== -1) gl.disableVertexAttribArray(programInfo.attribLocations.vertexNormal);
        if (programInfo.attribLocations.vertexColor !== -1) gl.disableVertexAttribArray(programInfo.attribLocations.vertexColor);

        for (const gameObject of scene.gameObjects) {
            if (!gameObject.mesh || gameObject.isLightObject) continue;

            gl.bindBuffer(gl.ARRAY_BUFFER, gameObject.mesh.vertexBuffer);
            gl.vertexAttribPointer(depthProgramInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(depthProgramInfo.attribLocations.vertexPosition);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gameObject.mesh.indexBuffer);

            const modelMatrix = gameObject.getModelMatrix();
            gl.uniformMatrix4fv(depthProgramInfo.uniformLocations.modelMatrix, false, modelMatrix);

            gl.drawElements(gl.TRIANGLES, gameObject.mesh.vertexCount, gl.UNSIGNED_SHORT, 0);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.cullFace(gl.BACK);
        gl.disable(gl.CULL_FACE);
    }

    // Pass 2: Main Pass
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(programInfo.program);

    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.lightSpaceMatrix, false, lightSpaceMatrix);

    gl.uniform1i(programInfo.uniformLocations.numLights, numLights);
    gl.uniform3fv(programInfo.uniformLocations.lightPos, paddedLightPos);
    gl.uniform3fv(programInfo.uniformLocations.lightColor, paddedLightColor);
    gl.uniform1fv(programInfo.uniformLocations.lightIntensity, paddedLightIntensity);
    gl.uniform1iv(programInfo.uniformLocations.lightType, paddedLightType);

    const camPos = camera ? camera.position : [0, 2, 5];
    gl.uniform3f(programInfo.uniformLocations.viewPosition, camPos[0], camPos[1], camPos[2]);

    if (hasDepthExt && shadowDepthTexture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, shadowDepthTexture);
        gl.uniform1i(programInfo.uniformLocations.shadowMap, 0);
        gl.uniform1i(programInfo.uniformLocations.hasShadowMap, 1);
    } else {
        gl.uniform1i(programInfo.uniformLocations.hasShadowMap, 0);
    }

    if (grid) {
        const identityMatrix = mat4.create();
        grid.render(gl, programInfo, identityMatrix);
    }

    for (const gameObject of scene.gameObjects) {
        if (!gameObject.mesh) continue;

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

        const mat = gameObject.material || { color: [0.85, 0.85, 0.85, 1.0], shininess: 32.0, roughness: 0.3, metallic: 0.1, isUnlit: false };
        gl.uniform4fv(programInfo.uniformLocations.materialColor, mat.color);
        gl.uniform1f(programInfo.uniformLocations.shininess, mat.shininess || 32.0);
        gl.uniform1f(programInfo.uniformLocations.roughness, mat.roughness !== undefined ? mat.roughness : 0.3);
        gl.uniform1f(programInfo.uniformLocations.metallic, mat.metallic !== undefined ? mat.metallic : 0.1);
        gl.uniform1i(programInfo.uniformLocations.isUnlit, (mat.isUnlit || gameObject.isLightObject) ? 1 : 0);
        gl.uniform1i(programInfo.uniformLocations.isSelected, gameObject === selectedGameObject ? 1 : 0);

        gl.drawElements(gl.TRIANGLES, gameObject.mesh.vertexCount, gl.UNSIGNED_SHORT, 0);
    }

    if (gizmo && selectedGameObject) {
        gl.uniform1i(programInfo.uniformLocations.isUnlit, 1);
        gl.uniform1i(programInfo.uniformLocations.isSelected, 0);
        gl.uniform4f(programInfo.uniformLocations.materialColor, 1.0, 1.0, 1.0, 1.0);
        gizmo.render(gl, programInfo, selectedGameObject, viewMatrix, projectionMatrix, mode, tool, brushRadius);
    }
}
