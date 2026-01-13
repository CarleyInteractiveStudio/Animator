import { mat4 } from './math.js';

export function initWebGL(canvas) {
    const gl = canvas.getContext('webgl');
    if (!gl) {
        console.error('WebGL not supported');
        return null;
    }

    const vertexShaderSource = `
        attribute vec4 a_position;
        attribute vec3 a_normal;
        attribute vec2 a_texCoord;

        uniform mat4 u_projectionMatrix;
        uniform mat4 u_viewMatrix;
        uniform mat4 u_modelMatrix;
        uniform mat4 u_normalMatrix;

        varying vec3 v_normal;
        varying vec3 v_worldPosition;
        varying vec2 v_texCoord;

        void main() {
            // Position in world space
            vec4 worldPosition = u_modelMatrix * a_position;
            v_worldPosition = worldPosition.xyz;

            // Output position in clip space
            gl_Position = u_projectionMatrix * u_viewMatrix * worldPosition;

            // Transform normal to world space
            v_normal = mat3(u_normalMatrix) * a_normal;

            // Pass texture coordinates to fragment shader
            v_texCoord = a_texCoord;
        }
    `;

    const fragmentShaderSource = `
        precision mediump float;

        varying vec3 v_normal;
        varying vec3 v_worldPosition;
        varying vec2 v_texCoord;

        uniform vec3 u_lightDirection;
        uniform vec3 u_viewPosition;
        uniform vec3 u_color;
        uniform float u_shininess;
        uniform sampler2D u_sampler;
        uniform bool u_useTexture;

        void main() {
            // Get base color
            vec4 baseColor;
            if (u_useTexture) {
                baseColor = texture2D(u_sampler, v_texCoord);
            } else {
                baseColor = vec4(u_color, 1.0);
            }

            // Ambient lighting
            float ambientStrength = 0.15;
            vec3 ambient = ambientStrength * baseColor.rgb;

            // Diffuse lighting
            vec3 normal = normalize(v_normal);
            vec3 lightDir = normalize(u_lightDirection);
            float diff = max(dot(normal, lightDir), 0.0);
            vec3 diffuse = diff * baseColor.rgb;

            // Specular lighting
            vec3 viewDir = normalize(u_viewPosition - v_worldPosition);
            vec3 reflectDir = reflect(-lightDir, normal);
            float spec = pow(max(dot(viewDir, reflectDir), 0.0), u_shininess);
            vec3 specular = 0.8 * spec * vec3(1.0, 1.0, 1.0); // Specular highlight is white

            vec3 result = ambient + diffuse + specular;
            gl_FragColor = vec4(result, baseColor.a);
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
            textureCoord: gl.getAttribLocation(program, 'a_texCoord'),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(program, 'u_projectionMatrix'),
            viewMatrix: gl.getUniformLocation(program, 'u_viewMatrix'),
            modelMatrix: gl.getUniformLocation(program, 'u_modelMatrix'),
            normalMatrix: gl.getUniformLocation(program, 'u_normalMatrix'),
            lightDirection: gl.getUniformLocation(program, 'u_lightDirection'),
            viewPosition: gl.getUniformLocation(program, 'u_viewPosition'),
            shininess: gl.getUniformLocation(program, 'u_shininess'),
            sampler: gl.getUniformLocation(program, 'u_sampler'),
            color: gl.getUniformLocation(program, 'u_color'),
            useTexture: gl.getUniformLocation(program, 'u_useTexture'),
        },
    };

    return { gl, programInfo };
}

export function renderWebGL(webglContext, canvas, scene, projectionMatrix, viewMatrix, cameraPosition) {
    const { gl, programInfo } = webglContext;

    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    gl.clearColor(0.13, 0.13, 0.13, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(programInfo.program);

    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);

    // Set lighting uniforms
    const lightDirection = [0.5, 0.7, 1.0];
    const normalizedLightDirection = new Float32Array(lightDirection.length);
    const len = Math.sqrt(lightDirection[0] * lightDirection[0] + lightDirection[1] * lightDirection[1] + lightDirection[2] * lightDirection[2]);
    normalizedLightDirection[0] = lightDirection[0] / len;
    normalizedLightDirection[1] = lightDirection[1] / len;
    normalizedLightDirection[2] = lightDirection[2] / len;
    gl.uniform3fv(programInfo.uniformLocations.lightDirection, normalizedLightDirection);

    // Set camera position uniform for specular lighting
    gl.uniform3fv(programInfo.uniformLocations.viewPosition, cameraPosition);


    for (const gameObject of scene.gameObjects) {
        if (!gameObject.mesh) {
            continue; // Skip objects without a mesh
        }

        gl.uniform1f(programInfo.uniformLocations.shininess, gameObject.material.shininess);

        // Bind texture and set uniforms
        if (gameObject.material.texture) {
            gameObject.material.texture.bind(0); // Bind to texture unit 0
            gl.uniform1i(programInfo.uniformLocations.sampler, 0); // Tell the shader to use texture unit 0
            gl.uniform1i(programInfo.uniformLocations.useTexture, 1); // true
        } else {
            gl.uniform1i(programInfo.uniformLocations.useTexture, 0); // false
            gl.uniform3fv(programInfo.uniformLocations.color, gameObject.material.color);
        }

        // Bind the vertex buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, gameObject.mesh.vertexBuffer);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

        // Bind the normal buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, gameObject.mesh.normalBuffer);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);

        // Bind the UV buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, gameObject.mesh.uvBuffer);
        gl.vertexAttribPointer(programInfo.attribLocations.textureCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);

        // Bind the index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gameObject.mesh.indexBuffer);

        // Set the model matrix uniform
        const modelMatrix = gameObject.getModelMatrix();
        gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, modelMatrix);

        // Calculate and set the normal matrix
        const normalMatrix = new Float32Array(16);
        mat4.invert(normalMatrix, modelMatrix);
        mat4.transpose(normalMatrix, normalMatrix);
        gl.uniformMatrix4fv(programInfo.uniformLocations.normalMatrix, false, normalMatrix);

        // Draw the object
        gl.drawElements(gl.TRIANGLES, gameObject.mesh.vertexCount, gl.UNSIGNED_SHORT, 0);
    }
}
