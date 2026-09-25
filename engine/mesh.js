export class Mesh {
    constructor(gl, vertices, indices, normals = null, colors = null) {
        this.gl = gl;
        this.vertices = new Float32Array(vertices);
        this.indices = new Uint16Array(indices);
        this.vertexCount = indices.length;

        if (!colors) {
            colors = [];
            for (let i = 0; i < vertices.length / 3; i++) {
                colors.push(1.0, 1.0, 1.0, 1.0);
            }
        }
        this.colors = new Float32Array(colors);

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

        const p1 = [this.vertices[i1] + normal[0] * distance, this.vertices[i1 + 1] + normal[1] * distance, this.vertices[i1 + 2] + normal[2] * distance];
        const p2 = [this.vertices[i2] + normal[0] * distance, this.vertices[i2 + 1] + normal[1] * distance, this.vertices[i2 + 2] + normal[2] * distance];
        const p3 = [this.vertices[i3] + normal[0] * distance, this.vertices[i3 + 1] + normal[1] * distance, this.vertices[i3 + 2] + normal[2] * distance];

        newVerts.push(...p1, ...p2, ...p3);
        newColors.push(1, 1, 1, 1,  1, 1, 1, 1,  1, 1, 1, 1);

        const n1 = newStartIdx;
        const n2 = newStartIdx + 1;
        const n3 = newStartIdx + 2;

        newIndices[faceIdx * 3] = n1;
        newIndices[faceIdx * 3 + 1] = n2;
        newIndices[faceIdx * 3 + 2] = n3;

        newIndices.push(i1Idx, i2Idx, n2);
        newIndices.push(i1Idx, n2, n1);

        newIndices.push(i2Idx, i3Idx, n3);
        newIndices.push(i2Idx, n3, n2);

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

    static createWireframeBox(gl, width = 1.0, height = 1.0, depth = 1.0) {
        const vertices = [];
        const indices = [];
        const colors = [];

        function addThickLine(x1, y1, z1, x2, y2, z2, radius, r, g, b, a = 1.0) {
            const start = vertices.length / 3;
            const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
            const len = Math.hypot(dx, dy, dz);
            if (len < 0.0001) return;

            let nx = -dy, ny = dx, nz = 0;
            if (Math.abs(nx) < 0.001 && Math.abs(ny) < 0.001) { nx = 1; ny = 0; }
            const nlen = Math.hypot(nx, ny, nz);
            nx = (nx / nlen) * radius; ny = (ny / nlen) * radius; nz = (nz / nlen) * radius;

            const px = (dy * nz - dz * ny) / radius;
            const py = (dz * nx - dx * nz) / radius;
            const pz = (dx * ny - dy * nx) / radius;
            const plen = Math.hypot(px, py, pz);
            const rx = (px / plen) * radius, ry = (py / plen) * radius, rz = (pz / plen) * radius;

            vertices.push(
                x1 - nx - rx, y1 - ny - ry, z1 - nz - rz,
                x1 + nx - rx, y1 + ny - ry, z1 + nz - rz,
                x1 + nx + rx, y1 + ny + ry, z1 + nz + rz,
                x1 - nx + rx, y1 - ny + ry, z1 - nz + rz,
                x2 - nx - rx, y2 - ny - ry, z2 - nz - rz,
                x2 + nx - rx, y2 + ny - ry, z2 + nz - rz,
                x2 + nx + rx, y2 + ny + ry, z2 + nz + rz,
                x2 - nx + rx, y2 - ny + ry, z2 - nz + rz
            );
            const quadIndices = [
                0, 1, 2, 0, 2, 3,   4, 6, 5, 4, 7, 6,
                3, 2, 6, 3, 6, 7,   0, 5, 1, 0, 4, 5,
                1, 5, 6, 1, 6, 2,   4, 0, 3, 4, 3, 7
            ];
            for (const idx of quadIndices) indices.push(start + idx);
            for (let i = 0; i < 8; i++) colors.push(r, g, b, a);
        }

        const hw = width * 0.5;
        const hh = height;
        const hd = depth * 0.5;
        const rad = 0.012;
        const r = 0.2, g = 0.95, b = 0.3, a = 0.95;

        const corners = [
            [-hw, 0,  hd], [ hw, 0,  hd], [ hw, 0, -hd], [-hw, 0, -hd],
            [-hw, hh, hd], [ hw, hh, hd], [ hw, hh, -hd], [-hw, hh, -hd]
        ];

        for (let i = 0; i < 4; i++) {
            const next = (i + 1) % 4;
            addThickLine(corners[i][0], corners[i][1], corners[i][2], corners[next][0], corners[next][1], corners[next][2], rad, r, g, b, a);
        }
        for (let i = 0; i < 4; i++) {
            const next = (i + 1) % 4 + 4;
            addThickLine(corners[i + 4][0], corners[i + 4][1], corners[i + 4][2], corners[next][0], corners[next][1], corners[next][2], rad, r, g, b, a);
        }
        for (let i = 0; i < 4; i++) {
            addThickLine(corners[i][0], corners[i][1], corners[i][2], corners[i + 4][0], corners[i + 4][1], corners[i + 4][2], rad, r, g, b, a);
        }

        return new Mesh(gl, vertices, indices, null, colors);
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

    static createDeformablePlane(gl, subdivisions = 48, size = 20) {
        const vertices = [];
        const indices = [];
        const colors = [];

        const halfSize = size / 2;
        const step = size / subdivisions;

        for (let z = 0; z <= subdivisions; z++) {
            const posZ = -halfSize + z * step;
            for (let x = 0; x <= subdivisions; x++) {
                const posX = -halfSize + x * step;
                vertices.push(posX, 0.0, posZ);
                colors.push(0.75, 0.8, 0.82, 1.0);
            }
        }

        for (let z = 0; z < subdivisions; z++) {
            for (let x = 0; x < subdivisions; x++) {
                const row1 = z * (subdivisions + 1);
                const row2 = (z + 1) * (subdivisions + 1);

                const i1 = row1 + x;
                const i2 = row1 + x + 1;
                const i3 = row2 + x;
                const i4 = row2 + x + 1;

                indices.push(i1, i3, i2);
                indices.push(i2, i3, i4);
            }
        }

        return new Mesh(gl, vertices, indices, null, colors);
    }

    static createSmoothTerrain(gl, options = {}) {
        const width = options.width || 36;
        const depth = options.depth || 36;
        const heightScale = options.heightScale !== undefined ? options.heightScale : 6.0;
        const noiseScale = options.noiseScale || 0.08;
        const seed = options.seed || 1234;
        const subdivisions = options.subdivisions || 64;
        const waterLevel = options.waterLevel !== undefined ? options.waterLevel : 0.5;

        const vertices = [];
        const indices = [];
        const colors = [];

        function rnd(s) {
            const x = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
            return x - Math.floor(x);
        }

        // Multi-octave FBM Perlin noise algorithm for organic Roblox Studio terrain
        function fbm2D(x, z) {
            let total = 0.0;
            let freq = noiseScale;
            let amp = 1.0;
            let maxAmp = 0.0;

            for (let i = 0; i < 4; i++) {
                const sx = x * freq + (seed % 100) * 2.3;
                const sz = z * freq + (seed % 100) * 3.7;

                const n = 0.5 * (Math.sin(sx) + Math.cos(sz) + Math.sin(sx * 1.3 - sz * 0.9));
                total += n * amp;
                maxAmp += amp;

                freq *= 2.1;
                amp *= 0.45;
            }

            let normalized = total / maxAmp;
            // Valley erosion curve
            if (normalized < 0.2) {
                normalized = normalized * 0.5;
            }
            return normalized;
        }

        const halfW = width / 2;
        const halfD = depth / 2;
        const stepX = width / subdivisions;
        const stepZ = depth / subdivisions;

        const heights = [];

        for (let z = 0; z <= subdivisions; z++) {
            const posZ = -halfD + z * stepZ;
            for (let x = 0; x <= subdivisions; x++) {
                const posX = -halfW + x * stepX;
                const rawH = fbm2D(posX, posZ);
                const posY = rawH * heightScale;

                vertices.push(posX, posY, posZ);
                heights.push(posY);
                colors.push(1.0, 1.0, 1.0, 1.0); // Base color passed to Splatmap shader
            }
        }

        for (let z = 0; z < subdivisions; z++) {
            for (let x = 0; x < subdivisions; x++) {
                const row1 = z * (subdivisions + 1);
                const row2 = (z + 1) * (subdivisions + 1);

                const i1 = row1 + x;
                const i2 = row1 + x + 1;
                const i3 = row2 + x;
                const i4 = row2 + x + 1;

                indices.push(i1, i3, i2);
                indices.push(i2, i3, i4);
            }
        }

        const mesh = new Mesh(gl, vertices, indices, null, colors);
        mesh.terrainHeights = heights;
        mesh.terrainSubdivisions = subdivisions;
        mesh.terrainWidth = width;
        mesh.terrainDepth = depth;
        return mesh;
    }

    static createTree(gl, seed = 1) {
        const vertices = [];
        const indices = [];
        const colors = [];

        function rnd(s) {
            const x = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
            return x - Math.floor(x);
        }

        // Bark Trunk
        const trunkHeight = 2.2 + rnd(seed * 1.5) * 0.8;
        const trunkRadiusBottom = 0.28;
        const trunkRadiusTop = 0.14;
        const trunkSegs = 10;

        for (let i = 0; i <= trunkSegs; i++) {
            const a = (i * Math.PI * 2) / trunkSegs;
            const cosA = Math.cos(a);
            const sinA = Math.sin(a);

            vertices.push(cosA * trunkRadiusBottom, 0, sinA * trunkRadiusBottom);
            colors.push(0.38, 0.24, 0.14, 1.0);

            vertices.push(cosA * trunkRadiusTop, trunkHeight, sinA * trunkRadiusTop);
            colors.push(0.32, 0.20, 0.11, 1.0);
        }

        for (let i = 0; i < trunkSegs; i++) {
            const b = i * 2;
            indices.push(b, b + 1, b + 2);
            indices.push(b + 1, b + 3, b + 2);
        }

        // Foliage Canopies
        const layers = 3;
        for (let l = 0; l < layers; l++) {
            const layerY = trunkHeight * 0.65 + l * 0.75;
            const layerRadius = 1.1 - l * 0.22;
            const layerHeight = 1.3 - l * 0.18;
            const fSegs = 12;

            const baseIndex = vertices.length / 3;

            vertices.push(0, layerY + layerHeight, 0);
            colors.push(0.22, 0.68 - l * 0.08, 0.24, 1.0);

            for (let i = 0; i <= fSegs; i++) {
                const a = (i * Math.PI * 2) / fSegs;
                const bump = 1.0 + (rnd(seed * (i + l * 10)) - 0.5) * 0.25;
                const rx = Math.cos(a) * layerRadius * bump;
                const rz = Math.sin(a) * layerRadius * bump;

                vertices.push(rx, layerY, rz);
                colors.push(0.18, 0.58 - l * 0.06, 0.20, 1.0);
            }

            for (let i = 0; i < fSegs; i++) {
                indices.push(baseIndex, baseIndex + 1 + i, baseIndex + 2 + i);
            }
        }

        return new Mesh(gl, vertices, indices, null, colors);
    }

    static createRock(gl, seed = 1) {
        const vertices = [];
        const indices = [];
        const colors = [];

        function rnd(s) {
            const x = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
            return x - Math.floor(x);
        }

        const latBands = 10;
        const longBands = 10;
        const radius = 0.7;

        for (let lat = 0; lat <= latBands; lat++) {
            const theta = (lat * Math.PI) / latBands;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            for (let lon = 0; lon <= longBands; lon++) {
                const phi = (lon * 2 * Math.PI) / longBands;
                const nx = Math.cos(phi) * sinTheta;
                const ny = cosTheta;
                const nz = Math.sin(phi) * sinTheta;

                const deform = 1.0 + (rnd(seed * 3.1 + lat * 2 + lon * 5) - 0.5) * 0.45;
                const px = nx * radius * deform * 1.25;
                const py = Math.max(0, ny * radius * deform * 0.85);
                const pz = nz * radius * deform;

                vertices.push(px, py, pz);

                const cVar = (rnd(seed * 1.7 + lat + lon) - 0.5) * 0.12;
                colors.push(0.48 + cVar, 0.48 + cVar, 0.52 + cVar, 1.0);
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

        return new Mesh(gl, vertices, indices, null, colors);
    }

    static createGrassTuft(gl, seed = 1) {
        const vertices = [];
        const indices = [];
        const colors = [];

        const blades = 6;
        for (let b = 0; b < blades; b++) {
            const angle = (b / blades) * Math.PI;
            const height = 0.55 + (b % 3) * 0.18;
            const width = 0.09;

            const cosA = Math.cos(angle) * width;
            const sinA = Math.sin(angle) * width;

            const baseIdx = vertices.length / 3;

            vertices.push(-cosA, 0, -sinA);
            colors.push(0.18, 0.52, 0.14, 1.0);

            vertices.push(cosA, 0, sinA);
            colors.push(0.18, 0.52, 0.14, 1.0);

            const lean = (b % 2 === 0 ? 0.18 : -0.18);
            vertices.push(sinA * lean, height, cosA * lean);
            colors.push(0.32, 0.82, 0.22, 1.0);

            indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
        }

        return new Mesh(gl, vertices, indices, null, colors);
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

    static createCloudPuff(gl, radius = 0.4) {
        const vertices = [];
        const normals = [];
        const indices = [];
        const colors = [];

        const latBands = 12;
        const longBands = 12;

        for (let lat = 0; lat <= latBands; lat++) {
            const theta = (lat * Math.PI) / latBands;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            for (let lon = 0; lon <= longBands; lon++) {
                const phi = (lon * 2 * Math.PI) / longBands;
                const x = Math.cos(phi) * sinTheta;
                const y = cosTheta;
                const z = Math.sin(phi) * sinTheta;

                const bump = 1.0 + Math.sin(phi * 3.0) * Math.cos(theta * 2.0) * 0.15;

                vertices.push(x * radius * bump, y * radius * bump, z * radius * bump);
                normals.push(x, y, z);
                colors.push(0.75, 0.78, 0.82, 0.55);
            }
        }

        for (let lat = 0; lat < latBands; lat++) {
            for (let lon = 0; lon < longBands; lon++) {
                const first = lat * (longBands + 1) + lon;
                const second = first + longBands + 1;

                indices.push(first, first + 1, second);
                indices.push(second, second + 1, first + 1);
            }
        }

        return new Mesh(gl, vertices, indices, normals, colors);
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

    static createCloud(gl, seed = 1) {
        return Mesh.createProceduralCloud(gl, seed);
    }

    static createProceduralCloud(gl, seed = 1) {
        const vertices = [];
        const indices = [];

        function rnd(s) {
            const x = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
            return x - Math.floor(x);
        }

        const stretchX = 1.2 + rnd(seed * 1.1) * 1.6;
        const stretchY = 0.5 + rnd(seed * 2.3) * 0.7;
        const stretchZ = 0.8 + rnd(seed * 3.7) * 0.9;

        function fbm3D(x, y, z) {
            let val = 0.0;
            let freq = 1.2;
            let amp = 0.22;

            for (let i = 0; i < 3; i++) {
                const sx = x * freq + (seed % 100) * 1.7;
                const sy = y * freq + (seed % 100) * 2.3;
                const sz = z * freq + (seed % 100) * 3.1;

                const n = 0.5 * (Math.sin(sx) + Math.sin(sy + sz) + Math.cos(sz + sx));
                val += n * amp;
                freq *= 1.8;
                amp *= 0.45;
            }
            return val;
        }

        const latBands = 36;
        const longBands = 36;

        for (let lat = 0; lat <= latBands; lat++) {
            const theta = (lat * Math.PI) / latBands;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            for (let lon = 0; lon <= longBands; lon++) {
                const phi = (lon * 2 * Math.PI) / longBands;
                const nx = Math.cos(phi) * sinTheta;
                const ny = cosTheta;
                const nz = Math.sin(phi) * sinTheta;

                let px = nx * stretchX;
                let py = ny * stretchY;
                let pz = nz * stretchZ;

                const displacement = fbm3D(px, py, pz);
                px += nx * displacement;
                py += ny * displacement * 1.1;
                pz += nz * displacement;

                vertices.push(px, py, pz);
            }
        }

        for (let lat = 0; lat < latBands; lat++) {
            for (let lon = 0; lon < longBands; lon++) {
                const first = lat * (longBands + 1) + lon;
                const second = first + longBands + 1;

                indices.push(first, first + 1, second);
                indices.push(second, second + 1, first + 1);
            }
        }

        return new Mesh(gl, vertices, indices);
    }

    static createTornadoVortex(gl) {
        const vertices = [];
        const indices = [];
        const colors = [];
        const segs = 16;
        const rad = 0.5;

        for (let i = 0; i <= segs; i++) {
            const a = (i * Math.PI * 2) / segs;
            vertices.push(Math.cos(a) * rad, 0.05, Math.sin(a) * rad);
            vertices.push(Math.cos(a) * (rad + 0.05), 0.05, Math.sin(a) * (rad + 0.05));
            colors.push(0.3, 0.8, 1.0, 0.4, 0.3, 0.8, 1.0, 0.0);
        }
        for (let i = 0; i < segs; i++) {
            const i1 = i * 2;
            indices.push(i1, i1 + 1, i1 + 2, i1 + 1, i1 + 3, i1 + 2);
        }
        return new Mesh(gl, vertices, indices, null, colors);
    }

    static createWindRay(gl) {
        const vertices = [];
        const indices = [];
        const colors = [];

        const segments = 10;
        const length = 1.4;
        const w = 0.045;

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const z = (t - 0.5) * length;
            const curveY = Math.sin(t * Math.PI) * 0.14;
            const alpha = Math.sin(t * Math.PI) * 0.85;

            vertices.push(-w, curveY, z,   w, curveY, z);
            colors.push(0.85, 0.95, 1.0, alpha,   0.85, 0.95, 1.0, alpha);

            vertices.push(0, curveY - w, z,   0, curveY + w, z);
            colors.push(0.85, 0.95, 1.0, alpha,   0.85, 0.95, 1.0, alpha);
        }

        for (let i = 0; i < segments; i++) {
            const base = i * 4;
            const next = (i + 1) * 4;

            indices.push(base, base + 1, next + 1, base, next + 1, next);
            indices.push(base + 2, base + 3, next + 3, base + 2, next + 3, next + 2);
        }

        return new Mesh(gl, vertices, indices, null, colors);
    }

    static createCinemaCamera(gl) {
        const vertices = [];
        const indices = [];
        const colors = [];

        function addThickLine(x1, y1, z1, x2, y2, z2, radius, r, g, b, a = 1.0) {
            const start = vertices.length / 3;
            const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
            const len = Math.hypot(dx, dy, dz);
            if (len < 0.0001) return;

            let nx = -dy, ny = dx, nz = 0;
            if (Math.abs(nx) < 0.001 && Math.abs(ny) < 0.001) { nx = 1; ny = 0; }
            const nlen = Math.hypot(nx, ny, nz);
            nx = (nx / nlen) * radius; ny = (ny / nlen) * radius; nz = (nz / nlen) * radius;

            const px = (dy * nz - dz * ny) / radius;
            const py = (dz * nx - dx * nz) / radius;
            const pz = (dx * ny - dy * nx) / radius;
            const plen = Math.hypot(px, py, pz);
            const rx = (px / plen) * radius, ry = (py / plen) * radius, rz = (pz / plen) * radius;

            vertices.push(
                x1 - nx - rx, y1 - ny - ry, z1 - nz - rz,
                x1 + nx - rx, y1 + ny - ry, z1 + nz - rz,
                x1 + nx + rx, y1 + ny + ry, z1 + nz + rz,
                x1 - nx + rx, y1 - ny + ry, z1 - nz + rz,
                x2 - nx - rx, y2 - ny - ry, z2 - nz - rz,
                x2 + nx - rx, y2 + ny - ry, z2 + nz - rz,
                x2 + nx + rx, y2 + ny + ry, z2 + nz + rz,
                x2 - nx + rx, y2 - ny + ry, z2 - nz + rz
            );
            const quadIndices = [
                0, 1, 2, 0, 2, 3,   4, 6, 5, 4, 7, 6,
                3, 2, 6, 3, 6, 7,   0, 5, 1, 0, 4, 5,
                1, 5, 6, 1, 6, 2,   4, 0, 3, 4, 3, 7
            ];
            for (const idx of quadIndices) indices.push(start + idx);
            for (let i = 0; i < 8; i++) colors.push(r, g, b, a);
        }

        const cr = 0.2, cg = 0.95, cb = 0.3;
        const rad = 0.012;

        const bw = 0.4, bh = 0.28, bd = 0.5;
        const bCorners = [
            [-bw, -bh, 0.0], [ bw, -bh, 0.0], [ bw,  bh, 0.0], [-bw,  bh, 0.0],
            [-bw, -bh, bd ], [ bw, -bh, bd ], [ bw,  bh, bd ], [-bw,  bh, bd ]
        ];
        for (let i = 0; i < 4; i++) {
            const next = (i + 1) % 4;
            addThickLine(bCorners[i][0], bCorners[i][1], bCorners[i][2], bCorners[next][0], bCorners[next][1], bCorners[next][2], rad, cr, cg, cb);
            addThickLine(bCorners[i+4][0], bCorners[i+4][1], bCorners[i+4][2], bCorners[next+4][0], bCorners[next+4][1], bCorners[next+4][2], rad, cr, cg, cb);
            addThickLine(bCorners[i][0], bCorners[i][1], bCorners[i][2], bCorners[i+4][0], bCorners[i+4][1], bCorners[i+4][2], rad, cr, cg, cb);
        }

        const lw = 0.22, lh = 0.16, lz = -0.2;
        const lCorners = [
            [-lw, -lh, lz], [ lw, -lh, lz], [ lw,  lh, lz], [-lw,  lh, lz]
        ];
        for (let i = 0; i < 4; i++) {
            const next = (i + 1) % 4;
            addThickLine(lCorners[i][0], lCorners[i][1], lCorners[i][2], lCorners[next][0], lCorners[next][1], lCorners[next][2], rad, cr, cg, cb);
            addThickLine(bCorners[i][0] * 0.6, bCorners[i][1] * 0.6, 0.0, lCorners[i][0], lCorners[i][1], lCorners[i][2], rad, cr, cg, cb);
        }

        const fw = 1.3, fh = 0.85, fz = -2.5;
        const fCorners = [
            [-fw, -fh, fz], [ fw, -fh, fz], [ fw,  fh, fz], [-fw,  fh, fz]
        ];
        for (let i = 0; i < 4; i++) {
            const next = (i + 1) % 4;
            addThickLine(lCorners[i][0], lCorners[i][1], lCorners[i][2], fCorners[i][0], fCorners[i][1], fCorners[i][2], rad, cr, cg, cb);
            addThickLine(fCorners[i][0], fCorners[i][1], fCorners[i][2], fCorners[next][0], fCorners[next][1], fCorners[next][2], rad, cr, cg, cb);
        }

        addThickLine(0, bh, bd * 0.5, 0, bh + 0.3, bd * 0.5, rad, cr, cg, cb);
        addThickLine(-bw * 0.4, bh, bd * 0.5, 0, bh + 0.3, bd * 0.5, rad, cr, cg, cb);
        addThickLine(bw * 0.4, bh, bd * 0.5, 0, bh + 0.3, bd * 0.5, rad, cr, cg, cb);

        return new Mesh(gl, vertices, indices, null, colors);
    }
}
