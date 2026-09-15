import { vec3 } from './math.js';

export const Paint = {
    applyBrush: (gameObject, hitPoint, brushRadius, tool = 'brush', color = [1, 0, 0, 1]) => {
        if (!gameObject || !gameObject.mesh) return;

        const mesh = gameObject.mesh;
        const vertices = mesh.vertices;
        const colors = mesh.colors;
        const pos = gameObject.transform.position;

        if (tool === 'fill') {
            for (let i = 0; i < colors.length; i += 4) {
                colors[i] = color[0];
                colors[i + 1] = color[1];
                colors[i + 2] = color[2];
                colors[i + 3] = color[3];
            }
            mesh.updateColorBuffer();
            return;
        }

        const localHit = vec3.create();
        vec3.subtract(localHit, hitPoint, pos);

        let modified = false;
        const targetColor = tool === 'eraser' ? [1, 1, 1, 1] : color;

        for (let i = 0, cIndex = 0; i < vertices.length; i += 3, cIndex += 4) {
            const vx = vertices[i];
            const vy = vertices[i + 1];
            const vz = vertices[i + 2];

            const dist = Math.hypot(vx - localHit[0], vy - localHit[1], vz - localHit[2]);

            if (dist < brushRadius) {
                const falloff = Math.pow(1 - dist / brushRadius, 2);

                colors[cIndex] += (targetColor[0] - colors[cIndex]) * falloff;
                colors[cIndex + 1] += (targetColor[1] - colors[cIndex + 1]) * falloff;
                colors[cIndex + 2] += (targetColor[2] - colors[cIndex + 2]) * falloff;
                colors[cIndex + 3] += (targetColor[3] - colors[cIndex + 3]) * falloff;
                modified = true;
            }
        }

        if (modified) {
            mesh.updateColorBuffer();
        }
    }
};
