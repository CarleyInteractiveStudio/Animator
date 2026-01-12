export class Mesh {
    constructor(gl, vertices, indices) {
        this.vertices = vertices;
        this.indices = indices;
        this.vertexCount = indices.length;

        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    }

    static createCube(gl) {
        const vertices = [
            // Front face
            -0.5, -0.5,  0.5,
             0.5, -0.5,  0.5,
             0.5,  0.5,  0.5,
            -0.5,  0.5,  0.5,

            // Back face
            -0.5, -0.5, -0.5,
             0.5, -0.5, -0.5,
             0.5,  0.5, -0.5,
            -0.5,  0.5, -0.5,
        ];

        const indices = [
            // Front
            0, 1, 2,  0, 2, 3,
            // Back
            4, 5, 6,  4, 6, 7,
            // Top
            3, 2, 6,  3, 6, 7,
            // Bottom
            0, 1, 5,  0, 5, 4,
            // Right
            1, 5, 6,  1, 6, 2,
            // Left
            4, 0, 3,  4, 3, 7,
        ];

        return new Mesh(gl, vertices, indices);
    }

    static createPlane(gl) {
        const vertices = [
            // Top face
            -0.5, 0.0, -0.5,
             0.5, 0.0, -0.5,
             0.5, 0.0,  0.5,
            -0.5, 0.0,  0.5,
        ];

        const indices = [
            0, 1, 2, 0, 2, 3,
        ];

        return new Mesh(gl, vertices, indices);
    }
}
