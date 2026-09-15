import { vec3 } from './math.js';

export const Sculpt = {
    applyBrush: (gameObject, hitPoint, brushRadius, tool = 'deform', strength = 0.05) => {
        if (!gameObject || !gameObject.mesh) return;

        const mesh = gameObject.mesh;
        const vertices = mesh.vertices;
        const normals = mesh.normals;
        const pos = gameObject.transform.position;

        const localHit = vec3.create();
        vec3.subtract(localHit, hitPoint, pos);

        let modified = false;

        for (let i = 0; i < vertices.length; i += 3) {
            const vx = vertices[i];
            const vy = vertices[i + 1];
            const vz = vertices[i + 2];

            const dist = Math.hypot(vx - localHit[0], vy - localHit[1], vz - localHit[2]);

            if (dist < brushRadius) {
                const falloff = Math.pow(1 - dist / brushRadius, 2);
                const factor = strength * falloff;

                if (tool === 'inflate' || tool === 'deform') {
                    const nx = normals[i] || 0;
                    const ny = normals[i + 1] || 1;
                    const nz = normals[i + 2] || 0;

                    vertices[i] += nx * factor;
                    vertices[i + 1] += ny * factor;
                    vertices[i + 2] += nz * factor;
                    modified = true;
                } else if (tool === 'smooth') {
                    vertices[i] += (localHit[0] - vx) * factor * 0.2;
                    vertices[i + 1] += (localHit[1] - vy) * factor * 0.2;
                    vertices[i + 2] += (localHit[2] - vz) * factor * 0.2;
                    modified = true;
                }
            }
        }

        if (modified) {
            mesh.updateVertexBuffer();
        }
    }
};
