import { Mesh } from './mesh.js';
import { mat4, quat } from './math.js';

export class Gizmo {
    constructor(gl) {
        this.gl = gl;
        this.initGizmos(gl);
    }

    initGizmos(gl) {
        // Translation Gizmo: Shaft (cylinder) + Arrow Tip (cone)
        const arrowShaft = Mesh.createCylinder(gl, 0.02, 1.2, 12);
        const arrowCone = Mesh.createCone(gl, 0.08, 0.3, 16);

        this.translationMesh = { shaft: arrowShaft, cone: arrowCone };

        // Scale Gizmo: Shaft (cylinder) + Handle Box (cube)
        const scaleBox = Mesh.createCube(gl);
        this.scaleMesh = { shaft: arrowShaft, box: scaleBox };

        // Rotation Gizmo: Torus rings
        this.rotationRing = Mesh.createTorus(gl, 1.2, 0.02, 24, 24);

        // Brush Ring (for Sculpting & Painting)
        this.brushRing = Mesh.createTorus(gl, 0.8, 0.015, 32, 16);
    }

    render(gl, programInfo, targetObject, viewMatrix, projectionMatrix, mode = 'object', tool = 'translate', brushRadius = 0.8) {
        if (!targetObject) return;

        gl.disable(gl.DEPTH_TEST);
        gl.useProgram(programInfo.program);

        const pos = targetObject.transform.position;

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
            { dir: [1, 0, 0], rot: [0, 0, -Math.PI / 2], color: [1.0, 0.2, 0.2, 1.0] },  // +X Red
            { dir: [-1, 0, 0], rot: [0, 0, Math.PI / 2], color: [0.8, 0.3, 0.3, 1.0] },  // -X Soft Red
            { dir: [0, 1, 0], rot: [0, 0, 0], color: [0.2, 1.0, 0.2, 1.0] },             // +Y Green
            { dir: [0, -1, 0], rot: [Math.PI, 0, 0], color: [0.3, 0.8, 0.3, 1.0] },       // -Y Soft Green
            { dir: [0, 0, 1], rot: [Math.PI / 2, 0, 0], color: [0.2, 0.5, 1.0, 1.0] },   // +Z Blue
            { dir: [0, 0, -1], rot: [-Math.PI / 2, 0, 0], color: [0.3, 0.5, 0.8, 1.0] }   // -Z Soft Blue
        ];

        for (const axis of directions) {
            gl.uniform4f(programInfo.uniformLocations.tintColor, ...axis.color);

            // Shaft
            const shaftMatrix = mat4.create();
            const shaftPos = [pos[0] + axis.dir[0] * 0.6, pos[1] + axis.dir[1] * 0.6, pos[2] + axis.dir[2] * 0.6];
            const q = quat.create();
            quat.fromEuler(q, axis.rot[0] * 180 / Math.PI, axis.rot[1] * 180 / Math.PI, axis.rot[2] * 180 / Math.PI);
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

        const rings = [
            { rot: [0, Math.PI / 2, 0], color: [1.0, 0.2, 0.2, 1.0] }, // X Ring
            { rot: [Math.PI / 2, 0, 0], color: [0.2, 1.0, 0.2, 1.0] }, // Y Ring
            { rot: [0, 0, 0], color: [0.2, 0.5, 1.0, 1.0] }            // Z Ring
        ];

        for (const ring of rings) {
            gl.uniform4f(programInfo.uniformLocations.tintColor, ...ring.color);

            const matrix = mat4.create();
            const q = quat.create();
            quat.fromEuler(q, ring.rot[0] * 180 / Math.PI, ring.rot[1] * 180 / Math.PI, ring.rot[2] * 180 / Math.PI);
            mat4.fromRotationTranslationScale(matrix, q, pos, [1, 1, 1]);

            gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, matrix);
            this.drawMesh(gl, programInfo, this.rotationRing);
        }
    }

    renderScaleGizmo(gl, programInfo, pos, viewMatrix, projectionMatrix) {
        gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);

        const directions = [
            { dir: [1, 0, 0], rot: [0, 0, -Math.PI / 2], color: [1.0, 0.2, 0.2, 1.0] },
            { dir: [-1, 0, 0], rot: [0, 0, Math.PI / 2], color: [0.8, 0.3, 0.3, 1.0] },
            { dir: [0, 1, 0], rot: [0, 0, 0], color: [0.2, 1.0, 0.2, 1.0] },
            { dir: [0, -1, 0], rot: [Math.PI, 0, 0], color: [0.3, 0.8, 0.3, 1.0] },
            { dir: [0, 0, 1], rot: [Math.PI / 2, 0, 0], color: [0.2, 0.5, 1.0, 1.0] },
            { dir: [0, 0, -1], rot: [-Math.PI / 2, 0, 0], color: [0.3, 0.5, 0.8, 1.0] }
        ];

        for (const axis of directions) {
            gl.uniform4f(programInfo.uniformLocations.tintColor, ...axis.color);

            // Shaft
            const shaftMatrix = mat4.create();
            const shaftPos = [pos[0] + axis.dir[0] * 0.6, pos[1] + axis.dir[1] * 0.6, pos[2] + axis.dir[2] * 0.6];
            const q = quat.create();
            quat.fromEuler(q, axis.rot[0] * 180 / Math.PI, axis.rot[1] * 180 / Math.PI, axis.rot[2] * 180 / Math.PI);
            mat4.fromRotationTranslationScale(shaftMatrix, q, shaftPos, [1, 1, 1]);
            gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, shaftMatrix);
            this.drawMesh(gl, programInfo, this.scaleMesh.shaft);

            // Box Tip
            const boxMatrix = mat4.create();
            const boxPos = [pos[0] + axis.dir[0] * 1.3, pos[1] + axis.dir[1] * 1.3, pos[2] + axis.dir[2] * 1.3];
            mat4.fromRotationTranslationScale(boxMatrix, q, boxPos, [0.15, 0.15, 0.15]);
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

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
        gl.drawElements(gl.TRIANGLES, mesh.vertexCount, gl.UNSIGNED_SHORT, 0);
    }
}
