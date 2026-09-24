import { Mesh } from './mesh.js';
import { mat4, quat } from './math.js';

export class Gizmo {
    constructor(gl) {
        this.gl = gl;
        this.initGizmos(gl);
    }

    initGizmos(gl) {
        // Translation Gizmo: Shaft (cylinder) + Arrow Tip (cone)
        const arrowShaft = Mesh.createCylinder(gl, 0.025, 1.2, 16);
        const arrowCone = Mesh.createCone(gl, 0.1, 0.35, 20);

        this.translationMesh = { shaft: arrowShaft, cone: arrowCone };

        // Scale Gizmo: Shaft (cylinder) + Handle Box (cube)
        const scaleBox = Mesh.createCube(gl);
        this.scaleMesh = { shaft: arrowShaft, box: scaleBox };

        // Rotation Gizmo: Torus rings (thicker & smoother)
        this.rotationRing = Mesh.createTorus(gl, 1.3, 0.035, 32, 24);

        // Brush Ring (for Sculpting & Painting)
        this.brushRing = Mesh.createTorus(gl, 0.8, 0.02, 32, 16);

        // Edit Mode Sub-element Highlight Sphere (Blender Orange Vertex Indicator)
        this.vertexDot = Mesh.createSphere(gl, 0.06, 12, 12);
    }

    renderWindZoneAreaBox(gl, programInfo, targetObject, viewMatrix, projectionMatrix) {
        if (!targetObject || !targetObject.windZone) return;

        const wz = targetObject.windZone;
        const size = wz.size || [8.0, 6.0, 8.0];

        if (!this.windBoxCache || this.windBoxCache.width !== size[0] || this.windBoxCache.height !== size[1] || this.windBoxCache.depth !== size[2]) {
            this.windBoxMesh = Mesh.createWireframeBox(gl, size[0], size[1], size[2]);
            this.windBoxCache = { width: size[0], height: size[1], depth: size[2] };
        }

        gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);

        const matrix = targetObject.getModelMatrix();
        gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, matrix);
        gl.uniform4f(programInfo.uniformLocations.tintColor, 0.0, 0.85, 1.0, 0.9);

        this.drawMesh(gl, programInfo, this.windBoxMesh);
    }

    renderSubElementOverlay(gl, programInfo, targetObject, selectedSubElement, viewMatrix, projectionMatrix) {
        if (!targetObject || !targetObject.mesh || !selectedSubElement) return;

        gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);

        const modelMatrix = targetObject.getModelMatrix();
        const type = selectedSubElement.type; // 'vertex', 'edge', 'face'
        const idx = selectedSubElement.index;

        gl.uniform4f(programInfo.uniformLocations.tintColor, 1.0, 0.65, 0.0, 1.0); // Blender Highlight Orange

        if (type === 'vertex') {
            const vIdx = idx * 3;
            const vx = targetObject.mesh.vertices[vIdx];
            const vy = targetObject.mesh.vertices[vIdx + 1];
            const vz = targetObject.mesh.vertices[vIdx + 2];

            const dotMatrix = mat4.create();
            mat4.translate(dotMatrix, modelMatrix, [vx, vy, vz]);
            gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, dotMatrix);
            this.drawMesh(gl, programInfo, this.vertexDot);
        } else if (type === 'face') {
            const centroid = targetObject.mesh.getFaceCentroid(idx);
            const dotMatrix = mat4.create();
            mat4.translate(dotMatrix, modelMatrix, centroid);
            gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, dotMatrix);
            this.drawMesh(gl, programInfo, this.vertexDot);
        }
    }

    render(gl, programInfo, targetObject, viewMatrix, projectionMatrix, mode = 'object', tool = 'translate', brushRadius = 0.8) {
        if (!targetObject) return;

        gl.disable(gl.DEPTH_TEST);
        gl.useProgram(programInfo.program);

        const pos = targetObject.transform.position;

        if (targetObject.windZone) {
            this.renderWindZoneAreaBox(gl, programInfo, targetObject, viewMatrix, projectionMatrix);
        }

        if (mode === 'sculpt' || mode === 'paint') {
            this.renderBrushCursor(gl, programInfo, pos, brushRadius, viewMatrix, projectionMatrix);
        } else if (mode === 'object') {
            if (tool === 'translate') {
                this.renderTranslationGizmo(gl, programInfo, pos, viewMatrix, projectionMatrix);
            } else if (tool === 'rotate') {
                this.renderRotationGizmo(gl, programInfo, pos, viewMatrix, projectionMatrix);
            } else if (tool === 'scale') {
                this.renderScaleGizmo(gl, programInfo, pos, viewMatrix, projectionMatrix);
            }
        }

        gl.enable(gl.DEPTH_TEST);
    }

    renderBrushCursor(gl, programInfo, pos, brushRadius, viewMatrix, projectionMatrix) {
        const matrix = mat4.create();
        mat4.fromRotationTranslationScale(matrix, quat.create(), pos, [brushRadius, brushRadius, brushRadius]);

        gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);
        gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, matrix);
        gl.uniform4f(programInfo.uniformLocations.tintColor, 0.3, 0.8, 1.0, 1.0);

        this.drawMesh(gl, programInfo, this.brushRing);
    }

    renderTranslationGizmo(gl, programInfo, pos, viewMatrix, projectionMatrix) {
        gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);

        // 6 Directions: +X, -X, +Y, -Y, +Z, -Z
        const directions = [
            { dir: [1, 0, 0], rot: [0, 0, -90], color: [1.0, 0.25, 0.25, 1.0] },  // +X Bright Red
            { dir: [-1, 0, 0], rot: [0, 0, 90], color: [0.85, 0.35, 0.35, 1.0] },  // -X Red
            { dir: [0, 1, 0], rot: [0, 0, 0], color: [0.25, 1.0, 0.25, 1.0] },    // +Y Bright Green
            { dir: [0, -1, 0], rot: [180, 0, 0], color: [0.35, 0.85, 0.35, 1.0] }, // -Y Green
            { dir: [0, 0, 1], rot: [90, 0, 0], color: [0.3, 0.6, 1.0, 1.0] },     // +Z Bright Blue
            { dir: [0, 0, -1], rot: [-90, 0, 0], color: [0.35, 0.5, 0.85, 1.0] }  // -Z Blue
        ];

        for (const axis of directions) {
            gl.uniform4f(programInfo.uniformLocations.tintColor, ...axis.color);

            // Shaft
            const shaftMatrix = mat4.create();
            const shaftPos = [pos[0] + axis.dir[0] * 0.6, pos[1] + axis.dir[1] * 0.6, pos[2] + axis.dir[2] * 0.6];
            const q = quat.create();
            quat.fromEuler(q, axis.rot[0], axis.rot[1], axis.rot[2]);
            mat4.fromRotationTranslationScale(shaftMatrix, q, shaftPos, [1, 1, 1]);
            gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, shaftMatrix);
            this.drawMesh(gl, programInfo, this.translationMesh.shaft);

            // Cone Tip
            const coneMatrix = mat4.create();
            const conePos = [pos[0] + axis.dir[0] * 1.35, pos[1] + axis.dir[1] * 1.35, pos[2] + axis.dir[2] * 1.35];
            mat4.fromRotationTranslationScale(coneMatrix, q, conePos, [1, 1, 1]);
            gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, coneMatrix);
            this.drawMesh(gl, programInfo, this.translationMesh.cone);
        }
    }

    renderRotationGizmo(gl, programInfo, pos, viewMatrix, projectionMatrix) {
        gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);

        // 3 Rings around X, Y, Z axes
        const rings = [
            { rot: [0, 90, 0], color: [1.0, 0.25, 0.25, 1.0] }, // X Ring (Red)
            { rot: [90, 0, 0], color: [0.25, 1.0, 0.25, 1.0] }, // Y Ring (Green)
            { rot: [0, 0, 0], color: [0.3, 0.6, 1.0, 1.0] }     // Z Ring (Blue)
        ];

        for (const ring of rings) {
            gl.uniform4f(programInfo.uniformLocations.tintColor, ...ring.color);

            const matrix = mat4.create();
            const q = quat.create();
            quat.fromEuler(q, ring.rot[0], ring.rot[1], ring.rot[2]);
            mat4.fromRotationTranslationScale(matrix, q, pos, [1, 1, 1]);

            gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, matrix);
            this.drawMesh(gl, programInfo, this.rotationRing);
        }
    }

    renderScaleGizmo(gl, programInfo, pos, viewMatrix, projectionMatrix) {
        gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);

        const directions = [
            { dir: [1, 0, 0], rot: [0, 0, -90], color: [1.0, 0.25, 0.25, 1.0] },
            { dir: [-1, 0, 0], rot: [0, 0, 90], color: [0.85, 0.35, 0.35, 1.0] },
            { dir: [0, 1, 0], rot: [0, 0, 0], color: [0.25, 1.0, 0.25, 1.0] },
            { dir: [0, -1, 0], rot: [180, 0, 0], color: [0.35, 0.85, 0.35, 1.0] },
            { dir: [0, 0, 1], rot: [90, 0, 0], color: [0.3, 0.6, 1.0, 1.0] },
            { dir: [0, 0, -1], rot: [-90, 0, 0], color: [0.35, 0.5, 0.85, 1.0] }
        ];

        for (const axis of directions) {
            gl.uniform4f(programInfo.uniformLocations.tintColor, ...axis.color);

            // Shaft
            const shaftMatrix = mat4.create();
            const shaftPos = [pos[0] + axis.dir[0] * 0.6, pos[1] + axis.dir[1] * 0.6, pos[2] + axis.dir[2] * 0.6];
            const q = quat.create();
            quat.fromEuler(q, axis.rot[0], axis.rot[1], axis.rot[2]);
            mat4.fromRotationTranslationScale(shaftMatrix, q, shaftPos, [1, 1, 1]);
            gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, shaftMatrix);
            this.drawMesh(gl, programInfo, this.scaleMesh.shaft);

            // Box Tip
            const boxMatrix = mat4.create();
            const boxPos = [pos[0] + axis.dir[0] * 1.3, pos[1] + axis.dir[1] * 1.3, pos[2] + axis.dir[2] * 1.3];
            mat4.fromRotationTranslationScale(boxMatrix, q, boxPos, [0.18, 0.18, 0.18]);
            gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, boxMatrix);
            this.drawMesh(gl, programInfo, this.scaleMesh.box);
        }
    }

    drawMesh(gl, programInfo, mesh) {
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

        if (programInfo.attribLocations.vertexNormal !== -1 && mesh.normalBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
            gl.vertexAttribPointer(programInfo.attribLocations.vertexNormal, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);
        }

        if (programInfo.attribLocations.vertexColor !== -1) {
            gl.disableVertexAttribArray(programInfo.attribLocations.vertexColor);
            gl.vertexAttrib4f(programInfo.attribLocations.vertexColor, 1.0, 1.0, 1.0, 1.0);
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
        gl.drawElements(gl.TRIANGLES, mesh.vertexCount, gl.UNSIGNED_SHORT, 0);
    }
}
