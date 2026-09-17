export class Mesh {
    constructor(gl, vertices, indices, normals = null, colors = null) {
        this.gl = gl;
        this.vertices = new Float32Array(vertices);
        this.indices = new Uint16Array(indices);
        this.vertexCount = indices.length;

        // Default white colors if not provided
        if (!colors) {
            colors = [];
            for (let i = 0; i < vertices.length / 3; i++) {
                colors.push(1.0, 1.0, 1.0, 1.0);
            }
        }
        this.colors = new Float32Array(colors);

        // Recalculate or store normals
        if (!normals) {
            normals = Mesh.calculateNormals(this.vertices, this.indices);
        }
        this.normals = new Float32Array(normals);

        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.DYNAMIC_DRAW);

        this.colorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.colors, gl.DYNAMIC_DRAW);

        this.normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.normals, gl.DYNAMIC_DRAW);

        this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);
    }

    updateVertexBuffer() {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, this.vertices);

        this.normals = new Float32Array(Mesh.calculateNormals(this.vertices, this.indices));
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.normalBuffer);
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, this.normals);
    }

    updateColorBuffer() {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, this.colors);
    }

    static calculateNormals(vertices, indices) {
        const normals = new Float32Array(vertices.length);

        for (let i = 0; i < indices.length; i += 3) {
            const i1 = indices[i] * 3;
            const i2 = indices[i + 1] * 3;
            const i3 = indices[i + 2] * 3;

            const ax = vertices[i1], ay = vertices[i1 + 1], az = vertices[i1 + 2];
            const bx = vertices[i2], by = vertices[i2 + 1], bz = vertices[i2 + 2];
            const cx = vertices[i3], cy = vertices[i3 + 1], cz = vertices[i3 + 2];

            const v1x = bx - ax, v1y = by - ay, v1z = bz - az;
            const v2x = cx - ax, v2y = cy - ay, v2z = cz - az;

            const nx = v1y * v2z - v1z * v2y;
            const ny = v1z * v2x - v1x * v2z;
            const nz = v1x * v2y - v1y * v2x;

            normals[i1] += nx; normals[i1 + 1] += ny; normals[i1 + 2] += nz;
            normals[i2] += nx; normals[i2 + 1] += ny; normals[i2 + 2] += nz;
            normals[i3] += nx; normals[i3 + 1] += ny; normals[i3 + 2] += nz;
        }

        // Normalize
        for (let i = 0; i < normals.length; i += 3) {
            const nx = normals[i], ny = normals[i + 1], nz = normals[i + 2];
            const len = Math.hypot(nx, ny, nz) || 1.0;
            normals[i] /= len;
            normals[i + 1] /= len;
            normals[i + 2] /= len;
        }

        return normals;
    }

    static createCube(gl) {
        const vertices = [
            -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5, // Front
            -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5,  0.5, -0.5,  -0.5,  0.5, -0.5, // Back
        ];
        const indices = [
            0, 1, 2, 0, 2, 3,    4, 6, 5, 4, 7, 6,
            3, 2, 6, 3, 6, 7,    0, 5, 1, 0, 4, 5,
            1, 5, 6, 1, 6, 2,    4, 0, 3, 4, 3, 7
        ];
        return new Mesh(gl, vertices, indices);
    }

    static createPlane(gl) {
        const vertices = [
            -1.0, 0.0, -1.0,
             1.0, 0.0, -1.0,
             1.0, 0.0,  1.0,
            -1.0, 0.0,  1.0
        ];
        const indices = [0, 1, 2, 0, 2, 3];
        return new Mesh(gl, vertices, indices);
    }

    static createSphere(gl, radius = 0.5, latBands = 16, longBands = 16) {
        const vertices = [];
        const indices = [];

        for (let lat = 0; lat <= latBands; lat++) {
            const theta = (lat * Math.PI) / latBands;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            for (let lon = 0; lon <= longBands; lon++) {
                const phi = (lon * 2 * Math.PI) / longBands;
                const x = Math.cos(phi) * sinTheta;
                const y = cosTheta;
                const z = Math.sin(phi) * sinTheta;

                vertices.push(x * radius, y * radius, z * radius);
            }
        }

        for (let lat = 0; lat < latBands; lat++) {
            for (let lon = 0; lon < longBands; lon++) {
                const first = lat * (longBands + 1) + lon;
                const second = first + longBands + 1;

                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }

        return new Mesh(gl, vertices, indices);
    }

    static createCylinder(gl, radius = 0.5, height = 1.0, segments = 16) {
        const vertices = [];
        const indices = [];
        const halfH = height / 2;

        // Top center & bottom center
        vertices.push(0, halfH, 0); // index 0
        vertices.push(0, -halfH, 0); // index 1

        for (let i = 0; i <= segments; i++) {
            const theta = (i * 2 * Math.PI) / segments;
            const x = Math.cos(theta) * radius;
            const z = Math.sin(theta) * radius;

            vertices.push(x, halfH, z);  // Top rim
            vertices.push(x, -halfH, z); // Bottom rim
        }

        for (let i = 0; i < segments; i++) {
            const top1 = 2 + i * 2;
            const bot1 = top1 + 1;
            const top2 = top1 + 2;
            const bot2 = bot1 + 2;

            // Side faces
            indices.push(top1, bot1, top2);
            indices.push(bot1, bot2, top2);

            // Top cap
            indices.push(0, top2, top1);

            // Bottom cap
            indices.push(1, bot1, bot2);
        }

        return new Mesh(gl, vertices, indices);
    }

    static createCone(gl, radius = 0.5, height = 1.0, segments = 16) {
        const vertices = [];
        const indices = [];

        vertices.push(0, height / 2, 0); // Apex (index 0)
        vertices.push(0, -height / 2, 0); // Base center (index 1)

        for (let i = 0; i <= segments; i++) {
            const theta = (i * 2 * Math.PI) / segments;
            const x = Math.cos(theta) * radius;
            const z = Math.sin(theta) * radius;
            vertices.push(x, -height / 2, z);
        }

        for (let i = 0; i < segments; i++) {
            const b1 = 2 + i;
            const b2 = b1 + 1;

            // Side
            indices.push(0, b1, b2);
            // Base
            indices.push(1, b2, b1);
        }

        return new Mesh(gl, vertices, indices);
    }

    static createPyramid(gl, baseSize = 1.0, height = 1.0) {
        const h = height / 2;
        const b = baseSize / 2;
        const vertices = [
             0,  h,  0,   // Apex (0)
            -b, -h,  b,   // Bottom Front Left (1)
             b, -h,  b,   // Bottom Front Right (2)
             b, -h, -b,   // Bottom Back Right (3)
            -b, -h, -b    // Bottom Back Left (4)
        ];
        const indices = [
            0, 1, 2,  0, 2, 3,  0, 3, 4,  0, 4, 1, // Sides
            1, 4, 3,  1, 3, 2                       // Base
        ];
        return new Mesh(gl, vertices, indices);
    }

    static createRamp(gl, width = 1.0, height = 1.0, depth = 1.0) {
        const w = width / 2, h = height / 2, d = depth / 2;
        const vertices = [
            -w, -h,  d,   w, -h,  d,   w,  h, -d,  -w,  h, -d, // Sloped face & back top
            -w, -h, -d,   w, -h, -d                             // Bottom back
        ];
        const indices = [
            0, 1, 2,  0, 2, 3, // Sloped face
            4, 5, 2,  4, 2, 3, // Back face
            0, 4, 5,  0, 5, 1, // Bottom face
            0, 3, 4,           // Left side triangle
            1, 5, 2            // Right side triangle
        ];
        return new Mesh(gl, vertices, indices);
    }

    static createTorus(gl, radius = 0.6, tubeRadius = 0.2, radialSegments = 16, tubularSegments = 16) {
        const vertices = [];
        const indices = [];

        for (let i = 0; i <= radialSegments; i++) {
            const u = (i * 2 * Math.PI) / radialSegments;
            for (let j = 0; j <= tubularSegments; j++) {
                const v = (j * 2 * Math.PI) / tubularSegments;

                const x = (radius + tubeRadius * Math.cos(v)) * Math.cos(u);
                const y = tubeRadius * Math.sin(v);
                const z = (radius + tubeRadius * Math.cos(v)) * Math.sin(u);

                vertices.push(x, y, z);
            }
        }

        for (let i = 0; i < radialSegments; i++) {
            for (let j = 0; j < tubularSegments; j++) {
                const first = i * (tubularSegments + 1) + j;
                const second = first + tubularSegments + 1;

                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }

        return new Mesh(gl, vertices, indices);
    }

    static createBone(gl, length = 1.0, width = 0.15) {
        // Octahedral 3D bone mesh (Blender Armature style)
        const vertices = [
            0, 0, 0,                      // Root joint (0)
            -width, length * 0.25,  width, // Corner FL (1)
             width, length * 0.25,  width, // Corner FR (2)
             width, length * 0.25, -width, // Corner BR (3)
            -width, length * 0.25, -width, // Corner BL (4)
            0, length, 0                  // Tip joint (5)
        ];
        const indices = [
            0, 1, 2,  0, 2, 3,  0, 3, 4,  0, 4, 1, // Bottom pyramid
            5, 2, 1,  5, 3, 2,  5, 4, 3,  5, 1, 4  // Top pyramid
        ];
        return new Mesh(gl, vertices, indices);
    }

    static createExtrudedPolygon(gl, points2D, height = 1.0) {
        if (!points2D || points2D.length < 3) {
            // Default triangle if insufficient points
            points2D = [[-0.5, -0.5], [0.5, -0.5], [0.0, 0.5]];
        }

        const N = points2D.length;
        const halfH = height / 2;
        const vertices = [];
        const indices = [];

        // Calculate centroid
        let cx = 0, cz = 0;
        for (const p of points2D) {
            cx += p[0];
            cz += p[1];
        }
        cx /= N;
        cz /= N;

        // Top vertices (0 to N-1)
        for (let i = 0; i < N; i++) {
            vertices.push(points2D[i][0], halfH, points2D[i][1]);
        }

        // Bottom vertices (N to 2N-1)
        for (let i = 0; i < N; i++) {
            vertices.push(points2D[i][0], -halfH, points2D[i][1]);
        }

        // Centroid Top (2N)
        vertices.push(cx, halfH, cz);
        // Centroid Bottom (2N + 1)
        vertices.push(cx, -halfH, cz);

        const topCentroidIdx = 2 * N;
        const botCentroidIdx = 2 * N + 1;

        for (let i = 0; i < N; i++) {
            const nextIdx = (i + 1) % N;

            // Side faces
            const topCurr = i;
            const topNext = nextIdx;
            const botCurr = i + N;
            const botNext = nextIdx + N;

            indices.push(topCurr, botCurr, topNext);
            indices.push(topNext, botCurr, botNext);

            // Top Cap (Fan from centroid)
            indices.push(topCentroidIdx, topCurr, topNext);

            // Bottom Cap (Fan from centroid)
            indices.push(botCentroidIdx, botNext, botCurr);
        }

        return new Mesh(gl, vertices, indices);
    }
}
