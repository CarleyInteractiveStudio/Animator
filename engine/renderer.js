import { mat3, mat4 } from './math.js';

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

        uniform vec4 u_materialColor;
        uniform float u_shininess;
        uniform vec3 u_lightDirection;
        uniform bool u_isUnlit;
        uniform bool u_isSelected;

        void main() {
            vec4 baseColor = v_color * u_materialColor;

            if (u_isUnlit) {
                if (u_isSelected) {
                    baseColor.rgb += vec3(0.12, 0.12, 0.12);
                }
                gl_FragColor = baseColor;
            } else {
                vec3 normal = normalize(v_normal);
                vec3 lightDir = normalize(u_lightDirection);

                float diff = max(dot(normal, lightDir), 0.0);
                float ambient = 0.35;

                vec3 viewDir = vec3(0.0, 0.0, 1.0);
                vec3 reflectDir = reflect(-lightDir, normal);
                float spec = pow(max(dot(viewDir, reflectDir), 0.0), max(u_shininess, 1.0));

                float lighting = ambient + diff * 0.65;
                vec3 finalRgb = baseColor.rgb * lighting + vec3(spec * 0.15);

                if (u_isSelected) {
                    finalRgb += vec3(0.1, 0.08, 0.05);
                }

                gl_FragColor = vec4(finalRgb, baseColor.a);
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
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(program, 'u_projectionMatrix'),
            viewMatrix: gl.getUniformLocation(program, 'u_viewMatrix'),
            modelMatrix: gl.getUniformLocation(program, 'u_modelMatrix'),
            normalMatrix: gl.getUniformLocation(program, 'u_normalMatrix'),
            materialColor: gl.getUniformLocation(program, 'u_materialColor'),
            shininess: gl.getUniformLocation(program, 'u_shininess'),
            lightDirection: gl.getUniformLocation(program, 'u_lightDirection'),
            isUnlit: gl.getUniformLocation(program, 'u_isUnlit'),
            isSelected: gl.getUniformLocation(program, 'u_isSelected'),
        },
    };

    return { gl, programInfo };
}

export function renderWebGL(webglContext, canvas, scene, projectionMatrix, viewMatrix, selectedGameObject = null, gizmo = null, mode = 'object', tool = 'translate', brushRadius = 0.8, grid = null) {
    const { gl, programInfo } = webglContext;

    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(programInfo.program);

    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);

    // Get primary light direction if scene has a LightComponent, else default
    let lightDir = [0.5, 1.0, 0.7];
    if (scene && scene.gameObjects) {
        for (const obj of scene.gameObjects) {
            if (obj.components) {
                const lightComp = obj.components.find(c => c.type === 'light');
                if (lightComp && lightComp.enabled) {
                    lightDir = lightComp.direction || lightDir;
                    break;
                }
            }
        }
    }
    gl.uniform3f(programInfo.uniformLocations.lightDirection, lightDir[0], lightDir[1], lightDir[2]);

    // Render 3D Grid Floor first
    if (grid) {
        const identityMatrix = mat4.create();
        grid.render(gl, programInfo, identityMatrix);
    }

    // Render GameObjects
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

        const mat = gameObject.material || { color: [0.85, 0.85, 0.85, 1.0], shininess: 32.0, isUnlit: false };
        gl.uniform4fv(programInfo.uniformLocations.materialColor, mat.color);
        gl.uniform1f(programInfo.uniformLocations.shininess, mat.shininess || 32.0);
        gl.uniform1i(programInfo.uniformLocations.isUnlit, mat.isUnlit ? 1 : 0);
        gl.uniform1i(programInfo.uniformLocations.isSelected, gameObject === selectedGameObject ? 1 : 0);

        gl.drawElements(gl.TRIANGLES, gameObject.mesh.vertexCount, gl.UNSIGNED_SHORT, 0);
    }

    // Render Gizmo
    if (gizmo && selectedGameObject) {
        gl.uniform1i(programInfo.uniformLocations.isUnlit, 1);
        gl.uniform1i(programInfo.uniformLocations.isSelected, 0);
        gl.uniform4f(programInfo.uniformLocations.materialColor, 1.0, 1.0, 1.0, 1.0);
        gizmo.render(gl, programInfo, selectedGameObject, viewMatrix, projectionMatrix, mode, tool, brushRadius);
    }
}
