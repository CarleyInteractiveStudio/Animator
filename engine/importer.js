import { Mesh } from './mesh.js';
import { GameObject } from './gameObject.js';

export class OBJLoader {
    static parseOBJ(gl, text) {
        const lines = text.split('\n');
        const positions = [];
        const normals = [];
        const uvs = [];

        const outVertices = [];
        const outNormals = [];
        const outUVs = [];
        const outIndices = [];

        const vertMap = new Map();

        for (let line of lines) {
            line = line.trim();
            if (line.startsWith('#') || line === '') continue;

            const parts = line.split(/\s+/);
            const type = parts[0];

            if (type === 'v') {
                positions.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
            } else if (type === 'vn') {
                normals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
            } else if (type === 'vt') {
                uvs.push([parseFloat(parts[1]), parseFloat(parts[2])]);
            } else if (type === 'f') {
                const faceIndices = [];
                for (let i = 1; i < parts.length; i++) {
                    const vertSpec = parts[i].split('/');
                    const posIdx = parseInt(vertSpec[0]) - 1;
                    const uvIdx = vertSpec[1] ? parseInt(vertSpec[1]) - 1 : -1;
                    const normIdx = vertSpec[2] ? parseInt(vertSpec[2]) - 1 : -1;

                    const key = `${posIdx}/${uvIdx}/${normIdx}`;
                    let index;

                    if (vertMap.has(key)) {
                        index = vertMap.get(key);
                    } else {
                        const pos = positions[posIdx] || [0, 0, 0];
                        const norm = normIdx >= 0 && normals[normIdx] ? normals[normIdx] : [0, 1, 0];
                        const uv = uvIdx >= 0 && uvs[uvIdx] ? uvs[uvIdx] : [0, 0];

                        outVertices.push(...pos);
                        outNormals.push(...norm);
                        outUVs.push(...uv);

                        index = outVertices.length / 3 - 1;
                        vertMap.set(key, index);
                    }

                    faceIndices.push(index);
                }

                // Triangulate face (Fan triangulation)
                for (let i = 1; i < faceIndices.length - 1; i++) {
                    outIndices.push(faceIndices[0], faceIndices[i], faceIndices[i + 1]);
                }
            }
        }

        if (outVertices.length === 0) return null;
        return new Mesh(gl, outVertices, outIndices, outNormals);
    }

    static exportOBJ(gameObject) {
        if (!gameObject || !gameObject.mesh) return '';

        const mesh = gameObject.mesh;
        let objText = `# Exported from Blender-style Engine\n`;
        objText += `o ${gameObject.name}\n`;

        // Vertices
        for (let i = 0; i < mesh.vertices.length; i += 3) {
            objText += `v ${mesh.vertices[i].toFixed(6)} ${mesh.vertices[i + 1].toFixed(6)} ${mesh.vertices[i + 2].toFixed(6)}\n`;
        }

        // Normals
        if (mesh.normals && mesh.normals.length > 0) {
            for (let i = 0; i < mesh.normals.length; i += 3) {
                objText += `vn ${mesh.normals[i].toFixed(6)} ${mesh.normals[i + 1].toFixed(6)} ${mesh.normals[i + 2].toFixed(6)}\n`;
            }
        }

        // Faces (1-indexed)
        for (let i = 0; i < mesh.indices.length; i += 3) {
            const i1 = mesh.indices[i] + 1;
            const i2 = mesh.indices[i + 1] + 1;
            const i3 = mesh.indices[i + 2] + 1;
            if (mesh.normals && mesh.normals.length > 0) {
                objText += `f ${i1}//${i1} ${i2}//${i2} ${i3}//${i3}\n`;
            } else {
                objText += `f ${i1} ${i2} ${i3}\n`;
            }
        }

        return objText;
    }
}

export class GLTFLoader {
    static parseGLTF(gl, json, binaryBuffer = null) {
        if (!json.accessors || !json.bufferViews || !json.meshes) return null;

        const accessors = json.accessors;
        const bufferViews = json.bufferViews;
        const buffers = json.buffers;

        // Parse buffers if provided in base64
        const parsedBuffers = [];
        if (binaryBuffer) {
            parsedBuffers.push(binaryBuffer);
        } else if (buffers) {
            for (const buf of buffers) {
                if (buf.uri && buf.uri.startsWith('data:application/octet-stream;base64,')) {
                    const b64 = buf.uri.split(',')[1];
                    const binaryStr = window.atob(b64);
                    const bytes = new Uint8Array(binaryStr.length);
                    for (let i = 0; i < binaryStr.length; i++) {
                        bytes[i] = binaryStr.charCodeAt(i);
                    }
                    parsedBuffers.push(bytes.buffer);
                }
            }
        }

        const getBufferData = (accessorIdx) => {
            const acc = accessors[accessorIdx];
            const bv = bufferViews[acc.bufferView];
            const buf = parsedBuffers[bv.buffer || 0];
            const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);

            if (acc.componentType === 5126) { // FLOAT
                return new Float32Array(buf, byteOffset, acc.count * (acc.type === 'VEC3' ? 3 : acc.type === 'VEC2' ? 2 : 1));
            } else if (acc.componentType === 5123) { // UNSIGNED_SHORT
                return new Uint16Array(buf, byteOffset, acc.count);
            } else if (acc.componentType === 5125) { // UNSIGNED_INT
                return new Uint32Array(buf, byteOffset, acc.count);
            }
            return null;
        };

        const firstMesh = json.meshes[0];
        if (!firstMesh || !firstMesh.primitives || firstMesh.primitives.length === 0) return null;

        const prim = firstMesh.primitives[0];
        const posAttr = prim.attributes.POSITION;
        const normAttr = prim.attributes.NORMAL;
        const indicesAttr = prim.indices;

        if (posAttr === undefined || indicesAttr === undefined) return null;

        const positions = getBufferData(posAttr);
        const indicesData = getBufferData(indicesAttr);
        const normals = normAttr !== undefined ? getBufferData(normAttr) : null;

        return new Mesh(gl, positions, Array.from(indicesData), normals);
    }

    static exportGLTF(gameObject) {
        if (!gameObject || !gameObject.mesh) return null;

        const mesh = gameObject.mesh;

        // Pack vertices (Float32Array) and indices (Uint16Array) into a single ArrayBuffer
        const totalByteLength = mesh.vertices.byteLength + mesh.indices.byteLength;
        const combinedBuffer = new Uint8Array(totalByteLength);
        combinedBuffer.set(new Uint8Array(mesh.vertices.buffer, mesh.vertices.byteOffset, mesh.vertices.byteLength), 0);
        combinedBuffer.set(new Uint8Array(mesh.indices.buffer, mesh.indices.byteOffset, mesh.indices.byteLength), mesh.vertices.byteLength);

        // Convert combinedBuffer to Base64 URI string
        let binaryStr = '';
        for (let i = 0; i < combinedBuffer.length; i++) {
            binaryStr += String.fromCharCode(combinedBuffer[i]);
        }
        const base64URI = 'data:application/octet-stream;base64,' + window.btoa(binaryStr);

        const gltf = {
            asset: { version: "2.0", generator: "Blender-style Engine" },
            scenes: [{ nodes: [0] }],
            nodes: [{ mesh: 0, name: gameObject.name }],
            meshes: [{
                name: gameObject.name,
                primitives: [{
                    attributes: { POSITION: 0 },
                    indices: 1
                }]
            }],
            accessors: [
                {
                    bufferView: 0,
                    componentType: 5126, // FLOAT
                    count: mesh.vertices.length / 3,
                    type: "VEC3"
                },
                {
                    bufferView: 1,
                    componentType: 5123, // UNSIGNED_SHORT
                    count: mesh.indices.length,
                    type: "SCALAR"
                }
            ],
            bufferViews: [
                { buffer: 0, byteOffset: 0, byteLength: mesh.vertices.byteLength, target: 34962 },
                { buffer: 0, byteOffset: mesh.vertices.byteLength, byteLength: mesh.indices.byteLength, target: 34963 }
            ],
            buffers: [{
                byteLength: totalByteLength,
                uri: base64URI
            }]
        };

        return JSON.stringify(gltf, null, 2);
    }
}
