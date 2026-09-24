import { mat3, mat4, vec3 } from './math.js';
import Engine from '../engine.js';

export function initWebGL(canvas) {
    const gl = canvas.getContext('webgl');
    if (!gl) {
        console.error('WebGL not supported');
        return null;
    }

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

    // 1. Procedural 3D Skybox Shader Program
    const skyVertexShaderSource = `
        attribute vec2 a_position;
        varying vec2 v_uv;
        void main() {
            v_uv = a_position;
            gl_Position = vec4(a_position, 0.9999, 1.0);
        }
    `;

    const skyFragmentShaderSource = `
        precision mediump float;
        varying vec2 v_uv;

        uniform mat4 u_invProjViewRotation;
        uniform vec3 u_sunDirection;
        uniform vec3 u_moonDirection;
        uniform float u_timeOfDay;
        uniform float u_sunIntensity;
        uniform float u_starIntensity;
        uniform float u_time;
        uniform float u_cloudCoverage;
        uniform float u_cloudDensity;
        uniform float u_cloudAltitude;
        uniform float u_windSpeed;
        uniform bool u_showSkyClouds;
        uniform int u_envPreset; // 0 = Studio Dark, 1 = Dynamic 3D Sky, 2 = Custom

        uniform sampler2D u_customTexture;
        uniform bool u_useCustomTexture;

        float hash31(vec3 p) {
            p = fract(p * vec3(443.897, 441.423, 437.195));
            p += dot(p, p.yzx + 19.19);
            return fract((p.x + p.y) * p.z);
        }

        float noise3D(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);

            return mix(
                mix(mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), f.x),
                    mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
                mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
                    mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
        }

        float fbm3D(vec3 p) {
            float v = 0.0;
            float a = 0.5;
            vec3 shift = vec3(100.0);
            for (int i = 0; i < 4; ++i) {
                v += a * noise3D(p);
                p = p * 2.03 + shift;
                a *= 0.5;
            }
            return v;
        }

        void main() {
            if (u_envPreset == 0) {
                vec2 centerUV = v_uv * 0.5;
                float rad = length(centerUV);
                vec3 darkBg = mix(vec3(0.12, 0.12, 0.15), vec3(0.04, 0.04, 0.05), rad);
                gl_FragColor = vec4(darkBg, 1.0);
                return;
            }

            vec4 farPoint = u_invProjViewRotation * vec4(v_uv, 1.0, 1.0);
            vec3 dir = normalize(farPoint.xyz / farPoint.w);

            if (u_envPreset == 2 && u_useCustomTexture) {
                float u = 0.5 + atan(dir.z, dir.x) / (2.0 * 3.14159265);
                float v = 0.5 - asin(dir.y) / 3.14159265;
                gl_FragColor = texture2D(u_customTexture, vec2(u, v));
                return;
            }

            float sunY = u_sunDirection.y;

            float dayFactor = smoothstep(-0.2, 0.25, sunY);
            float sunsetFactor = smoothstep(0.35, -0.1, abs(sunY - 0.05));

            vec3 dayZenith = vec3(0.15, 0.45, 0.88);
            vec3 dayHorizon = vec3(0.68, 0.84, 0.98);

            vec3 sunsetZenith = vec3(0.18, 0.12, 0.38);
            vec3 sunsetHorizon = vec3(0.96, 0.48, 0.18);

            vec3 nightZenith = vec3(0.02, 0.03, 0.09);
            vec3 nightHorizon = vec3(0.06, 0.09, 0.18);

            vec3 groundColor = vec3(0.05, 0.06, 0.08);

            vec3 zenithColor = mix(nightZenith, mix(sunsetZenith, dayZenith, dayFactor), dayFactor);
            vec3 horizonColor = mix(nightHorizon, mix(sunsetHorizon, dayHorizon, dayFactor), dayFactor);

            if (sunsetFactor > 0.01 && dayFactor < 0.85) {
                zenithColor = mix(zenithColor, sunsetZenith, sunsetFactor * 0.65);
                horizonColor = mix(horizonColor, sunsetHorizon, sunsetFactor);
            }

            vec3 skyColor;
            if (dir.y >= 0.0) {
                float h = pow(dir.y, 0.55);
                skyColor = mix(horizonColor, zenithColor, h);

                if (sunY < 0.15) {
                    float nightVisibility = smoothstep(0.15, -0.2, sunY);
                    vec3 starDir = floor(dir * 180.0);
                    float starHash = hash31(starDir);
                    if (starHash > 0.987) {
                        float starBrightness = pow((starHash - 0.987) / (1.0 - 0.987), 2.0) * nightVisibility * u_starIntensity;
                        skyColor += vec3(starBrightness);
                    }
                }

                // Sun Disk & Glow
                float cosSun = dot(dir, normalize(u_sunDirection));
                if (cosSun > 0.0) {
                    float sunDisk = smoothstep(0.998, 0.9995, cosSun);
                    float sunGlow = pow(max(0.0, cosSun), 14.0) * 0.6;
                    vec3 sunColor = mix(vec3(1.0, 0.5, 0.2), vec3(1.0, 0.98, 0.85), clamp(sunY * 2.0, 0.0, 1.0));
                    skyColor += (sunDisk * 2.2 + sunGlow) * sunColor * u_sunIntensity * max(0.1, dayFactor + sunsetFactor);
                }

                // Moon Disk & Glow
                float cosMoon = dot(dir, normalize(u_moonDirection));
                if (cosMoon > 0.0) {
                    float moonDisk = smoothstep(0.9982, 0.9995, cosMoon);
                    float moonGlow = pow(max(0.0, cosMoon), 18.0) * 0.35;
                    vec3 moonColor = vec3(0.85, 0.92, 1.0);
                    float moonVisibility = smoothstep(0.1, -0.2, sunY);
                    skyColor += (moonDisk * 1.6 + moonGlow) * moonColor * moonVisibility;
                }
            } else {
                float g = clamp(-dir.y * 3.5, 0.0, 1.0);
                skyColor = mix(horizonColor * 0.85, groundColor, g);
            }

            // Volumetric Ray-Marched Atmospheric Sky Clouds
            if (u_showSkyClouds && dir.y > 0.02 && u_cloudCoverage > 0.01 && u_envPreset == 1) {
                vec3 cloudLightDir = normalize(u_sunDirection);
                float sunPhase = max(0.0, dot(dir, cloudLightDir));

                vec3 baseCloudTone = mix(vec3(0.08, 0.1, 0.18), vec3(0.98, 0.98, 1.0), dayFactor);
                if (sunsetFactor > 0.05) {
                    baseCloudTone = mix(baseCloudTone, vec3(0.95, 0.45, 0.25), sunsetFactor);
                }

                vec3 sunHighlight = mix(vec3(1.0, 0.8, 0.5), vec3(1.0, 1.0, 0.95), dayFactor) * (pow(sunPhase, 4.0) * 1.5 + 0.3);

                vec3 windOffset = vec3(u_time * u_windSpeed * 0.8, 0.0, u_time * u_windSpeed * 0.4);
                float alphaAccum = 1.0;
                vec3 accumCloudCol = vec3(0.0);

                float layerBottom = 80.0 * u_cloudAltitude;
                float layerTop = 160.0 * u_cloudAltitude;

                float stepSize = (layerTop - layerBottom) / 6.0;
                float startDist = layerBottom / dir.y;

                for (int step = 0; step < 6; step++) {
                    float rayDist = startDist + float(step) * stepSize / dir.y;
                    vec3 rayPos = dir * rayDist + windOffset;
                    vec3 samplePos = rayPos * 0.008;

                    float n = fbm3D(samplePos);
                    float density = smoothstep(1.05 - u_cloudCoverage, 1.0, n) * u_cloudDensity;

                    if (density > 0.01) {
                        float lightTransmittance = exp(-density * 0.8);
                        vec3 stepColor = mix(baseCloudTone * 0.4, baseCloudTone * sunHighlight, lightTransmittance);

                        accumCloudCol += stepColor * (1.0 - lightTransmittance) * alphaAccum;
                        alphaAccum *= lightTransmittance;

                        if (alphaAccum < 0.02) break;
                    }
                }

                skyColor = mix(skyColor, accumCloudCol, (1.0 - alphaAccum) * smoothstep(0.02, 0.15, dir.y));
            }

            gl_FragColor = vec4(skyColor, 1.0);
        }
    `;

    const skyVS = createShader(gl, gl.VERTEX_SHADER, skyVertexShaderSource);
    const skyFS = createShader(gl, gl.FRAGMENT_SHADER, skyFragmentShaderSource);
    const skyProgram = createProgram(gl, skyVS, skyFS);

    const skyProgramInfo = {
        program: skyProgram,
        attribLocations: {
            position: gl.getAttribLocation(skyProgram, 'a_position')
        },
        uniformLocations: {
            invProjViewRotation: gl.getUniformLocation(skyProgram, 'u_invProjViewRotation'),
            sunDirection: gl.getUniformLocation(skyProgram, 'u_sunDirection'),
            moonDirection: gl.getUniformLocation(skyProgram, 'u_moonDirection'),
            timeOfDay: gl.getUniformLocation(skyProgram, 'u_timeOfDay'),
            sunIntensity: gl.getUniformLocation(skyProgram, 'u_sunIntensity'),
            starIntensity: gl.getUniformLocation(skyProgram, 'u_starIntensity'),
            time: gl.getUniformLocation(skyProgram, 'u_time'),
            cloudCoverage: gl.getUniformLocation(skyProgram, 'u_cloudCoverage'),
            cloudDensity: gl.getUniformLocation(skyProgram, 'u_cloudDensity'),
            cloudAltitude: gl.getUniformLocation(skyProgram, 'u_cloudAltitude'),
            windSpeed: gl.getUniformLocation(skyProgram, 'u_windSpeed'),
            showSkyClouds: gl.getUniformLocation(skyProgram, 'u_showSkyClouds'),
            envPreset: gl.getUniformLocation(skyProgram, 'u_envPreset'),
            customTexture: gl.getUniformLocation(skyProgram, 'u_customTexture'),
            useCustomTexture: gl.getUniformLocation(skyProgram, 'u_useCustomTexture')
        }
    };

    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
         1,  1,
    ]), gl.STATIC_DRAW);

    // 2. Main Mesh Shader Program
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
        uniform float u_ambientIntensity;
        uniform bool u_isUnlit;

        // Texture and Procedural uniforms
        uniform int u_textureType;
        uniform float u_textureScale;
        uniform float u_metallic;
        uniform float u_roughness;

        // Volumetric God Rays & Raymarching Shafts
        uniform bool u_godRaysEnabled;
        uniform float u_godRaysDensity;
        uniform float u_godRaysExposure;
        uniform vec3 u_godRaysColor;

        // Darkness Zone & Extinction Volume
        uniform bool u_darknessEnabled;
        uniform vec3 u_darknessCenter;
        uniform float u_darknessRadius;
        uniform float u_darknessIntensity;
        uniform float u_darknessFog;

        // Cloud Material Translucency
        uniform bool u_isCloud;
        uniform float u_cloudTranslucency;
        uniform vec3 u_cloudTint;

        // 3D Volumetric Hash & Noise for per-pixel continuous surface texturing
        float hash3D(vec3 p) {
            p = fract(p * vec3(443.897, 441.423, 437.195));
            p += dot(p, p.yzx + 19.19);
            return fract((p.x + p.y) * p.z);
        }

        float noise3D(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);

            return mix(
                mix(mix(hash3D(i + vec3(0,0,0)), hash3D(i + vec3(1,0,0)), f.x),
                    mix(hash3D(i + vec3(0,1,0)), hash3D(i + vec3(1,1,0)), f.x), f.y),
                mix(mix(hash3D(i + vec3(0,0,1)), hash3D(i + vec3(1,0,1)), f.x),
                    mix(hash3D(i + vec3(0,1,1)), hash3D(i + vec3(1,1,1)), f.x), f.y), f.z);
        }

        float noise(vec2 p) {
            return noise3D(vec3(p, 0.0));
        }

        // Per-Pixel Triplanar Projection mapping for seamless textures across all angles and meshes
        vec4 getTriplanarCheckerboard(vec3 pos, vec3 norm, float scale) {
            vec3 blending = pow(abs(norm), vec3(4.0));
            blending = max(blending, 0.00001);
            blending /= (blending.x + blending.y + blending.z);

            vec2 chkX = floor(pos.yz * scale);
            float fX = mod(chkX.x + chkX.y, 2.0);

            vec2 chkY = floor(pos.xz * scale);
            float fY = mod(chkY.x + chkY.y, 2.0);

            vec2 chkZ = floor(pos.xy * scale);
            float fZ = mod(chkZ.x + chkZ.y, 2.0);

            float colX = mix(0.1, 0.9, fX);
            float colY = mix(0.1, 0.9, fY);
            float colZ = mix(0.1, 0.9, fZ);

            float finalVal = colX * blending.x + colY * blending.y + colZ * blending.z;
            return vec4(vec3(finalVal), 1.0);
        }

        float getTriplanarNoise(vec3 pos, vec3 norm, float scale) {
            vec3 blending = pow(abs(norm), vec3(4.0));
            blending = max(blending, 0.00001);
            blending /= (blending.x + blending.y + blending.z);

            float nX = noise3D(pos.yzx * scale);
            float nY = noise3D(pos.xzy * scale + vec3(17.1, 31.4, 9.2));
            float nZ = noise3D(pos.xyz * scale + vec3(5.3, 88.2, 12.8));

            return nX * blending.x + nY * blending.y + nZ * blending.z;
        }

        void main() {
            vec4 baseColor = v_color * u_tintColor;

            if (u_isCloud) {
                vec3 normal = normalize(v_normal);
                vec3 lightDir = normalize(u_lightDirection);
                vec3 viewDir = normalize(-v_worldPosition);

                float diff = max(dot(normal, lightDir), 0.0);

                // Subsurface Forward Light Scattering (Light transmitting through cloud body)
                float forwardScatter = max(0.0, dot(-viewDir, lightDir));
                float sss = pow(forwardScatter, 2.5) * u_cloudTranslucency;

                float lighting = u_ambientIntensity + diff * 0.55 + sss * 0.7;
                vec3 finalRGB = baseColor.rgb * u_cloudTint * lighting;

                // Warm golden scattering glow on edges
                finalRGB += vec3(1.0, 0.82, 0.45) * sss * 0.5;

                // 3D Procedural Cloud Noise Density & Edge Semi-Transparency
                vec3 cloudPos = v_worldPosition * 1.5;
                float noiseDensity = noise(cloudPos.xz) * 0.35 + noise(cloudPos.xy * 2.0) * 0.15;

                // Edge falloff based on view-normal alignment
                float edgeAlpha = pow(max(0.0, dot(normal, viewDir)), 0.65);
                float cloudAlpha = clamp(baseColor.a * (0.65 + noiseDensity) * edgeAlpha, 0.2, 0.95);

                gl_FragColor = vec4(finalRGB, cloudAlpha);
                return;
            }

            vec3 normNorm = normalize(v_normal);

            if (u_textureType == 1) {
                if (v_texcoord.x != 0.0 || v_texcoord.y != 0.0) {
                    vec2 chk = floor(v_texcoord * u_textureScale);
                    float f = mod(chk.x + chk.y, 2.0);
                    baseColor *= mix(vec4(0.1, 0.1, 0.1, 1.0), vec4(0.9, 0.9, 0.9, 1.0), f);
                } else {
                    baseColor *= getTriplanarCheckerboard(v_worldPosition, normNorm, u_textureScale);
                }
            } else if (u_textureType == 2) {
                float n = getTriplanarNoise(v_worldPosition, normNorm, u_textureScale);
                baseColor *= vec4(vec3(n), 1.0);
            }

            if (u_isUnlit) {
                gl_FragColor = baseColor;
            } else {
                vec3 normal = normalize(v_normal);
                vec3 lightDir = normalize(u_lightDirection);

                float diff = max(dot(normal, lightDir), 0.0);
                float ambient = u_ambientIntensity;

                // Specular highlight
                vec3 viewDir = normalize(-v_worldPosition);
                vec3 halfDir = normalize(lightDir + viewDir);
                float specAngle = max(dot(normal, halfDir), 0.0);
                float specPow = max(1.0, (1.0 - u_roughness) * 64.0);
                float specular = pow(specAngle, specPow) * u_metallic;

                float lighting = ambient + diff * 0.65;

                // Apply Darkness Zone Volumetric Extinction
                if (u_darknessEnabled) {
                    float distToCenter = length(v_worldPosition - u_darknessCenter);
                    if (distToCenter < u_darknessRadius) {
                        float darkFactor = smoothstep(u_darknessRadius, 0.0, distToCenter) * u_darknessIntensity;
                        lighting *= (1.0 - darkFactor);
                        specular *= (1.0 - darkFactor);
                    }
                }

                vec3 finalRGB = baseColor.rgb * lighting + vec3(specular);

                // 3D Volumetric Ray-marching Light Shafts / God Rays
                if (u_godRaysEnabled) {
                    vec3 rayStep = lightDir * 0.2;
                    vec3 currentPos = v_worldPosition;
                    float accumulatedRay = 0.0;

                    for (int i = 0; i < 8; i++) {
                        currentPos += rayStep;
                        float rayDensity = noise(currentPos.xz * 2.0);
                        accumulatedRay += rayDensity * 0.125;
                    }

                    float godRayIntensity = accumulatedRay * u_godRaysDensity * u_godRaysExposure;
                    finalRGB += u_godRaysColor * godRayIntensity;
                }

                // Dark Volumetric Absorption Fog
                if (u_darknessEnabled) {
                    float distToCenter = length(v_worldPosition - u_darknessCenter);
                    if (distToCenter < u_darknessRadius) {
                        float fogAmount = smoothstep(u_darknessRadius, 0.0, distToCenter) * u_darknessFog;
                        finalRGB = mix(finalRGB, vec3(0.01, 0.01, 0.01), fogAmount);
                    }
                }

                gl_FragColor = vec4(finalRGB, baseColor.a);
            }
        }
    `;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

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
            ambientIntensity: gl.getUniformLocation(program, 'u_ambientIntensity'),
            isUnlit: gl.getUniformLocation(program, 'u_isUnlit'),
            textureType: gl.getUniformLocation(program, 'u_textureType'),
            textureScale: gl.getUniformLocation(program, 'u_textureScale'),
            metallic: gl.getUniformLocation(program, 'u_metallic'),
            roughness: gl.getUniformLocation(program, 'u_roughness'),

            godRaysEnabled: gl.getUniformLocation(program, 'u_godRaysEnabled'),
            godRaysDensity: gl.getUniformLocation(program, 'u_godRaysDensity'),
            godRaysExposure: gl.getUniformLocation(program, 'u_godRaysExposure'),
            godRaysColor: gl.getUniformLocation(program, 'u_godRaysColor'),

            darknessEnabled: gl.getUniformLocation(program, 'u_darknessEnabled'),
            darknessCenter: gl.getUniformLocation(program, 'u_darknessCenter'),
            darknessRadius: gl.getUniformLocation(program, 'u_darknessRadius'),
            darknessIntensity: gl.getUniformLocation(program, 'u_darknessIntensity'),
            darknessFog: gl.getUniformLocation(program, 'u_darknessFog'),

            isCloud: gl.getUniformLocation(program, 'u_isCloud'),
            cloudTranslucency: gl.getUniformLocation(program, 'u_cloudTranslucency'),
            cloudTint: gl.getUniformLocation(program, 'u_cloudTint'),
        },
    };

    return { gl, programInfo, skyProgramInfo, quadBuffer };
}

export function renderWebGL(webglContext, canvas, scene, projectionMatrix, viewMatrix, selectedGameObject = null, gizmo = null, mode = 'object', tool = 'translate', brushRadius = 0.8) {
    const { gl, programInfo, skyProgramInfo, quadBuffer } = webglContext;

    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // --- 1. RENDER 3D SKYBOX ---
    const env = Engine ? Engine.environment : null;
    const timeOfDay = env ? env.timeOfDay : 12.0;

    // Calculate celestial Sun & Moon positions based on Time of Day
    const angle = ((timeOfDay - 6.0) / 24.0) * Math.PI * 2.0;
    const sunDir = vec3.fromValues(Math.cos(angle), Math.sin(angle), 0.3);
    vec3.normalize(sunDir, sunDir);

    const moonDir = vec3.fromValues(-sunDir[0], -sunDir[1], -sunDir[2]);

    if (skyProgramInfo && quadBuffer) {
        gl.useProgram(skyProgramInfo.program);
        gl.depthMask(false);

        // Inverse View-Rotation * Projection Matrix for full 3D viewport camera tracking
        const viewRot = mat4.clone(viewMatrix);
        viewRot[12] = 0; viewRot[13] = 0; viewRot[14] = 0; // strip camera position translation

        const projViewRot = mat4.create();
        mat4.multiply(projViewRot, projectionMatrix, viewRot);

        const invProjViewRot = mat4.create();
        mat4.invert(invProjViewRot, projViewRot);

        gl.uniformMatrix4fv(skyProgramInfo.uniformLocations.invProjViewRotation, false, invProjViewRot);
        gl.uniform3fv(skyProgramInfo.uniformLocations.sunDirection, sunDir);
        gl.uniform3fv(skyProgramInfo.uniformLocations.moonDirection, moonDir);
        gl.uniform1f(skyProgramInfo.uniformLocations.timeOfDay, timeOfDay);
        gl.uniform1f(skyProgramInfo.uniformLocations.sunIntensity, env ? env.sunIntensity : 1.0);
        gl.uniform1f(skyProgramInfo.uniformLocations.starIntensity, env ? env.starIntensity : 1.0);
        gl.uniform1f(skyProgramInfo.uniformLocations.time, Engine ? Engine.time : 0.0);
        gl.uniform1f(skyProgramInfo.uniformLocations.cloudCoverage, env ? env.cloudCoverage : 0.55);
        gl.uniform1f(skyProgramInfo.uniformLocations.cloudDensity, env ? env.cloudDensity : 1.0);
        gl.uniform1f(skyProgramInfo.uniformLocations.cloudAltitude, env ? env.cloudAltitude : 1.0);
        gl.uniform1f(skyProgramInfo.uniformLocations.windSpeed, env ? env.windSpeed : 0.5);
        gl.uniform1i(skyProgramInfo.uniformLocations.showSkyClouds, env && env.showSkyClouds !== undefined ? (env.showSkyClouds ? 1 : 0) : 1);

        let presetCode = 1; // Default: Dynamic 3D Sky
        if (env) {
            if (env.preset === 'dark') presetCode = 0;
            else if (env.preset === 'custom') presetCode = 2;
        }
        gl.uniform1i(skyProgramInfo.uniformLocations.envPreset, presetCode);

        if (env && env.customGLTexture) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, env.customGLTexture);
            gl.uniform1i(skyProgramInfo.uniformLocations.customTexture, 0);
            gl.uniform1i(skyProgramInfo.uniformLocations.useCustomTexture, 1);
        } else {
            gl.uniform1i(skyProgramInfo.uniformLocations.useCustomTexture, 0);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.vertexAttribPointer(skyProgramInfo.attribLocations.position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(skyProgramInfo.attribLocations.position);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.depthMask(true);
    }

    // --- 2. RENDER SCENE OBJECTS ---
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(programInfo.program);

    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);

    // Active light source direction (Sun during day, Moon during night)
    let activeLightDir = sunDir;
    if (sunDir[1] < -0.05) {
        activeLightDir = moonDir;
    }

    gl.uniform3fv(programInfo.uniformLocations.lightDirection, activeLightDir);
    gl.uniform1f(programInfo.uniformLocations.ambientIntensity, env ? env.ambientIntensity : 0.35);

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

        // Cloud Specific Properties
        if (gameObject.cloudProps) {
            gl.uniform1i(programInfo.uniformLocations.isCloud, 1);
            gl.uniform1f(programInfo.uniformLocations.cloudTranslucency, gameObject.cloudProps.translucency !== undefined ? gameObject.cloudProps.translucency : 0.6);
            gl.uniform3fv(programInfo.uniformLocations.cloudTint, gameObject.cloudProps.tint || [1.0, 1.0, 1.0]);
        } else {
            gl.uniform1i(programInfo.uniformLocations.isCloud, 0);
        }

        // Material & Volumetric / Darkness uniforms
        const mat = gameObject.material || {};
        gl.uniform1i(programInfo.uniformLocations.textureType, mat.textureType || 0);
        gl.uniform1f(programInfo.uniformLocations.textureScale, mat.textureScale || 5.0);
        gl.uniform1f(programInfo.uniformLocations.metallic, mat.metallic !== undefined ? mat.metallic : 0.2);
        gl.uniform1f(programInfo.uniformLocations.roughness, mat.roughness !== undefined ? mat.roughness : 0.5);

        // God Rays Component Uniforms
        if (gameObject.volumetricLight) {
            gl.uniform1i(programInfo.uniformLocations.godRaysEnabled, gameObject.volumetricLight.enabled ? 1 : 0);
            gl.uniform1f(programInfo.uniformLocations.godRaysDensity, gameObject.volumetricLight.density);
            gl.uniform1f(programInfo.uniformLocations.godRaysExposure, gameObject.volumetricLight.exposure);
            gl.uniform3fv(programInfo.uniformLocations.godRaysColor, gameObject.volumetricLight.color);
        } else {
            gl.uniform1i(programInfo.uniformLocations.godRaysEnabled, 0);
        }

        // Darkness Zone Component Uniforms
        if (gameObject.darknessZone) {
            gl.uniform1i(programInfo.uniformLocations.darknessEnabled, gameObject.darknessZone.enabled ? 1 : 0);
            gl.uniform3fv(programInfo.uniformLocations.darknessCenter, gameObject.transform.position);
            gl.uniform1f(programInfo.uniformLocations.darknessRadius, gameObject.darknessZone.radius);
            gl.uniform1f(programInfo.uniformLocations.darknessIntensity, gameObject.darknessZone.intensity);
            gl.uniform1f(programInfo.uniformLocations.darknessFog, gameObject.darknessZone.fogDensity);
        } else {
            gl.uniform1i(programInfo.uniformLocations.darknessEnabled, 0);
        }

        if (gameObject === selectedGameObject) {
            gl.uniform4f(programInfo.uniformLocations.tintColor, 0.6, 0.6, 0.7, 1.0);
        } else {
            gl.uniform4f(programInfo.uniformLocations.tintColor, 1.0, 1.0, 1.0, 1.0);
        }

        gl.drawElements(gl.TRIANGLES, gameObject.mesh.vertexCount, gl.UNSIGNED_SHORT, 0);
    }

    if (gizmo && selectedGameObject) {
        gl.uniform1i(programInfo.uniformLocations.isUnlit, 1);
        gl.uniform1i(programInfo.uniformLocations.textureType, 0);
        gl.uniform1i(programInfo.uniformLocations.godRaysEnabled, 0);
        gl.uniform1i(programInfo.uniformLocations.darknessEnabled, 0);
        gizmo.render(gl, programInfo, selectedGameObject, viewMatrix, projectionMatrix, mode, tool, brushRadius);

        if (mode === 'model' && Engine && Engine.selectedSubElement) {
            gizmo.renderSubElementOverlay(gl, programInfo, selectedGameObject, Engine.selectedSubElement, viewMatrix, projectionMatrix);
        }
    }
}
