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

    rebuildBuffers() {
        this.vertexCount = this.indices.length;
        this.normals = new Float32Array(Mesh.calculateNormals(this.vertices, this.indices));

        if (!this.colors || this.colors.length !== (this.vertices.length / 3) * 4) {
            const cols = [];
            for (let i = 0; i < this.vertices.length / 3; i++) {
                cols.push(1.0, 1.0, 1.0, 1.0);
            }
            this.colors = new Float32Array(cols);
        }

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.vertices, this.gl.DYNAMIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.colors, this.gl.DYNAMIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.normalBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.normals, this.gl.DYNAMIC_DRAW);

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.indices, this.gl.STATIC_DRAW);
    }

    getFaceCentroid(faceIdx) {
        const i1 = this.indices[faceIdx * 3] * 3;
        const i2 = this.indices[faceIdx * 3 + 1] * 3;
        const i3 = this.indices[faceIdx * 3 + 2] * 3;

        return [
            (this.vertices[i1] + this.vertices[i2] + this.vertices[i3]) / 3.0,
            (this.vertices[i1 + 1] + this.vertices[i2 + 1] + this.vertices[i3 + 1]) / 3.0,
            (this.vertices[i1 + 2] + this.vertices[i2 + 2] + this.vertices[i3 + 2]) / 3.0
        ];
    }

    getFaceNormal(faceIdx) {
        const i1 = this.indices[faceIdx * 3] * 3;
        const i2 = this.indices[faceIdx * 3 + 1] * 3;
        const i3 = this.indices[faceIdx * 3 + 2] * 3;

        const ax = this.vertices[i1], ay = this.vertices[i1 + 1], az = this.vertices[i1 + 2];
        const bx = this.vertices[i2], by = this.vertices[i2 + 1], bz = this.vertices[i2 + 2];
        const cx = this.vertices[i3], cy = this.vertices[i3 + 1], cz = this.vertices[i3 + 2];

        const v1x = bx - ax, v1y = by - ay, v1z = bz - az;
        const v2x = cx - ax, v2y = cy - ay, v2z = cz - az;

        const nx = v1y * v2z - v1z * v2y;
        const ny = v1z * v2x - v1x * v2z;
        const nz = v1x * v2y - v1y * v2x;

        const len = Math.hypot(nx, ny, nz) || 1.0;
        return [nx / len, ny / len, nz / len];
    }

    extrudeFace(faceIdx, distance = 0.5) {
        if (faceIdx < 0 || faceIdx * 3 >= this.indices.length) return;

        const i1Idx = this.indices[faceIdx * 3];
        const i2Idx = this.indices[faceIdx * 3 + 1];
        const i3Idx = this.indices[faceIdx * 3 + 2];

        const i1 = i1Idx * 3;
        const i2 = i2Idx * 3;
        const i3 = i3Idx * 3;

        const normal = this.getFaceNormal(faceIdx);

        const newVerts = Array.from(this.vertices);
        const newColors = this.colors ? Array.from(this.colors) : new Array((this.vertices.length / 3) * 4).fill(1.0);
        const newIndices = Array.from(this.indices);

        const newStartIdx = newVerts.length / 3;

        // Duplicate face vertices and move along normal
        const p1 = [this.vertices[i1] + normal[0] * distance, this.vertices[i1 + 1] + normal[1] * distance, this.vertices[i1 + 2] + normal[2] * distance];
        const p2 = [this.vertices[i2] + normal[0] * distance, this.vertices[i2 + 1] + normal[1] * distance, this.vertices[i2 + 2] + normal[2] * distance];
        const p3 = [this.vertices[i3] + normal[0] * distance, this.vertices[i3 + 1] + normal[1] * distance, this.vertices[i3 + 2] + normal[2] * distance];

        newVerts.push(...p1, ...p2, ...p3);
        newColors.push(1, 1, 1, 1,  1, 1, 1, 1,  1, 1, 1, 1);

        const n1 = newStartIdx;
        const n2 = newStartIdx + 1;
        const n3 = newStartIdx + 2;

        // Replace original face indices with extruded top face
        newIndices[faceIdx * 3] = n1;
        newIndices[faceIdx * 3 + 1] = n2;
        newIndices[faceIdx * 3 + 2] = n3;

        // Side Quad 1: (i1, i2, n2, n1)
        newIndices.push(i1Idx, i2Idx, n2);
        newIndices.push(i1Idx, n2, n1);

        // Side Quad 2: (i2, i3, n3, n2)
        newIndices.push(i2Idx, i3Idx, n3);
        newIndices.push(i2Idx, n3, n2);

        // Side Quad 3: (i3, i1, n1, n3)
        newIndices.push(i3Idx, i1Idx, n1);
        newIndices.push(i3Idx, n1, n3);

        this.vertices = new Float32Array(newVerts);
        this.colors = new Float32Array(newColors);
        this.indices = new Uint16Array(newIndices);

        this.rebuildBuffers();
    }

    subdivide() {
        const newVerts = Array.from(this.vertices);
        const newColors = this.colors ? Array.from(this.colors) : new Array((this.vertices.length / 3) * 4).fill(1.0);
        const newIndices = [];

        const midPointCache = new Map();

        const getMidPointIndex = (idx1, idx2) => {
            const key = idx1 < idx2 ? `${idx1}_${idx2}` : `${idx2}_${idx1}`;
            if (midPointCache.has(key)) {
                return midPointCache.get(key);
            }

            const i1 = idx1 * 3, i2 = idx2 * 3;
            const mx = (this.vertices[i1] + this.vertices[i2]) / 2.0;
            const my = (this.vertices[i1 + 1] + this.vertices[i2 + 1]) / 2.0;
            const mz = (this.vertices[i1 + 2] + this.vertices[i2 + 2]) / 2.0;

            const newIdx = newVerts.length / 3;
            newVerts.push(mx, my, mz);
            newColors.push(1, 1, 1, 1);

            midPointCache.set(key, newIdx);
            return newIdx;
        };

        for (let i = 0; i < this.indices.length; i += 3) {
            const a = this.indices[i];
            const b = this.indices[i + 1];
            const c = this.indices[i + 2];

            const ab = getMidPointIndex(a, b);
            const bc = getMidPointIndex(b, c);
            const ca = getMidPointIndex(c, a);

            newIndices.push(a, ab, ca);
            newIndices.push(b, bc, ab);
            newIndices.push(c, ca, bc);
            newIndices.push(ab, bc, ca);
        }

        this.vertices = new Float32Array(newVerts);
        this.colors = new Float32Array(newColors);
        this.indices = new Uint16Array(newIndices);

        this.rebuildBuffers();
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
            -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5,
            -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5,  0.5, -0.5,  -0.5,  0.5, -0.5,
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
        const normals = [];
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
                normals.push(x, y, z);
            }
        }

        for (let lat = 0; lat < latBands; lat++) {
            for (let lon = 0; lon < longBands; lon++) {
                const first = lat * (longBands + 1) + lon;
                const second = first + longBands + 1;

                indices.push(first, first + 1, second);
                indices.push(second, first + 1, second + 1);
            }
        }

        return new Mesh(gl, vertices, indices, normals);
    }

    static createCylinder(gl, radius = 0.5, height = 1.0, segments = 16) {
        const vertices = [];
        const indices = [];
        const halfH = height / 2;

        vertices.push(0, halfH, 0);
        vertices.push(0, -halfH, 0);

        for (let i = 0; i <= segments; i++) {
            const theta = (i * 2 * Math.PI) / segments;
            const x = Math.cos(theta) * radius;
            const z = Math.sin(theta) * radius;

            vertices.push(x, halfH, z);
            vertices.push(x, -halfH, z);
        }

        for (let i = 0; i < segments; i++) {
            const top1 = 2 + i * 2;
            const bot1 = top1 + 1;
            const top2 = top1 + 2;
            const bot2 = bot1 + 2;

            indices.push(top1, bot1, top2);
            indices.push(bot1, bot2, top2);

            indices.push(0, top2, top1);
            indices.push(1, bot1, bot2);
        }

        return new Mesh(gl, vertices, indices);
    }

    static createCone(gl, radius = 0.5, height = 1.0, segments = 16) {
        const vertices = [];
        const indices = [];

        vertices.push(0, height / 2, 0);
        vertices.push(0, -height / 2, 0);

        for (let i = 0; i <= segments; i++) {
            const theta = (i * 2 * Math.PI) / segments;
            const x = Math.cos(theta) * radius;
            const z = Math.sin(theta) * radius;
            vertices.push(x, -height / 2, z);
        }

        for (let i = 0; i < segments; i++) {
            const b1 = 2 + i;
            const b2 = b1 + 1;

            indices.push(0, b1, b2);
            indices.push(1, b2, b1);
        }

        return new Mesh(gl, vertices, indices);
    }

    static createPyramid(gl, baseSize = 1.0, height = 1.0) {
        const h = height / 2;
        const b = baseSize / 2;
        const vertices = [
             0,  h,  0,
            -b, -h,  b,
             b, -h,  b,
             b, -h, -b,
            -b, -h, -b
        ];
        const indices = [
            0, 1, 2,  0, 2, 3,  0, 3, 4,  0, 4, 1,
            1, 4, 3,  1, 3, 2
        ];
        return new Mesh(gl, vertices, indices);
    }

    static createRamp(gl, width = 1.0, height = 1.0, depth = 1.0) {
        const w = width / 2, h = height / 2, d = depth / 2;
        const vertices = [
            -w, -h,  d,   w, -h,  d,   w,  h, -d,  -w,  h, -d,
            -w, -h, -d,   w, -h, -d
        ];
        const indices = [
            0, 1, 2,  0, 2, 3,
            4, 5, 2,  4, 2, 3,
            0, 4, 5,  0, 5, 1,
            0, 3, 4,
            1, 5, 2
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
}
