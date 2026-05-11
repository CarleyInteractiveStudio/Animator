import { vec3, mat4 } from './math.js';
import { Mesh } from './mesh.js';

export class Gizmo {
    constructor(gl) {
        this.gl = gl;
        this.isVisible = false;
        this.activeAxis = null; // 1: X, 2: Y, 3: Z
        this.position = vec3.create();
        this.mode = 'translate'; // 'translate', 'rotate', 'scale'

        // Shared meshes for gizmo parts
        this.cubeMesh = Mesh.createCube(gl);
        this.sphereMesh = Mesh.createSphere(gl, 0.5, 16, 16);
    }

    setActiveAxis(axis) {
        this.activeAxis = axis;
    }

    render(gl, programInfo, isPicking) {
        if (!this.isVisible) return;

        const axes = [
            { id: 1, color: [1, 0, 0], axis: [1, 0, 0] },
            { id: 2, color: [0, 1, 0], axis: [0, 1, 0] },
            { id: 3, color: [0, 0, 1], axis: [0, 0, 1] }
        ];

        for (const a of axes) {
            const modelMatrix = mat4.create();
            mat4.translate(modelMatrix, modelMatrix, this.position);

            // Orient the axis
            if (a.id === 1) { // X
                mat4.rotateZ(modelMatrix, modelMatrix, -Math.PI / 2);
            } else if (a.id === 3) { // Z
                mat4.rotateX(modelMatrix, modelMatrix, Math.PI / 2);
            }

            if (this.mode === 'translate') {
                this.renderTranslateAxis(gl, programInfo, isPicking, a, modelMatrix);
            } else if (this.mode === 'rotate') {
                this.renderRotateAxis(gl, programInfo, isPicking, a, modelMatrix);
            } else if (this.mode === 'scale') {
                this.renderScaleAxis(gl, programInfo, isPicking, a, modelMatrix);
            }
        }
    }

    renderTranslateAxis(gl, programInfo, isPicking, a, modelMatrix) {
        // Line/Shaft
        const shaftMatrix = mat4.clone(modelMatrix);
        mat4.translate(shaftMatrix, shaftMatrix, [0, 0.5, 0]);
        mat4.scale(shaftMatrix, shaftMatrix, [0.02, 1.0, 0.02]);
        this.drawPart(gl, programInfo, isPicking, a, shaftMatrix);

        // Arrow head
        const headMatrix = mat4.clone(modelMatrix);
        mat4.translate(headMatrix, headMatrix, [0, 1.0, 0]);
        mat4.scale(headMatrix, headMatrix, [0.1, 0.15, 0.1]);
        // For simplicity using a small cube as head
        this.drawPart(gl, programInfo, isPicking, a, headMatrix);
    }

    renderRotateAxis(gl, programInfo, isPicking, a, modelMatrix) {
        // A ring. For simplicity we'll use a scaled flat cylinder or many cubes in circle
        // Here we just use a small torus-like shape or just a circle of cubes
        for (let i = 0; i < 32; i++) {
            const angle = (i / 32) * Math.PI * 2;
            const ringPartMatrix = mat4.clone(modelMatrix);
            // Move to circle position (X-Z plane in local space of oriented axis)
            mat4.translate(ringPartMatrix, ringPartMatrix, [Math.cos(angle) * 0.8, 0, Math.sin(angle) * 0.8]);
            mat4.scale(ringPartMatrix, ringPartMatrix, [0.03, 0.03, 0.03]);
            this.drawPart(gl, programInfo, isPicking, a, ringPartMatrix);
        }
    }

    renderScaleAxis(gl, programInfo, isPicking, a, modelMatrix) {
        // Line/Shaft
        const shaftMatrix = mat4.clone(modelMatrix);
        mat4.translate(shaftMatrix, shaftMatrix, [0, 0.5, 0]);
        mat4.scale(shaftMatrix, shaftMatrix, [0.02, 1.0, 0.02]);
        this.drawPart(gl, programInfo, isPicking, a, shaftMatrix);

        // Cube head
        const headMatrix = mat4.clone(modelMatrix);
        mat4.translate(headMatrix, headMatrix, [0, 1.0, 0]);
        mat4.scale(headMatrix, headMatrix, [0.1, 0.1, 0.1]);
        this.drawPart(gl, programInfo, isPicking, a, headMatrix);
    }

    drawPart(gl, programInfo, isPicking, a, modelMatrix) {
        gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, modelMatrix);

        if (isPicking) {
            const r = (a.id & 0xFF) / 255.0;
            const g = ((a.id >> 8) & 0xFF) / 255.0;
            const b = ((a.id >> 16) & 0xFF) / 255.0;
            gl.uniform4f(programInfo.uniformLocations.idColor, r, g, b, 1.0);
        } else {
            let color = a.color;
            if (this.activeAxis === a.id) {
                color = [1, 1, 0]; // Yellow for active
            }
            gl.uniform3fv(programInfo.uniformLocations.color, color);
            gl.uniform1i(programInfo.uniformLocations.useTexture, 0);
            gl.uniform1i(programInfo.uniformLocations.isUnlit, 1);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeMesh.vertexBuffer);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.cubeMesh.indexBuffer);
        gl.drawElements(gl.TRIANGLES, this.cubeMesh.vertexCount, gl.UNSIGNED_SHORT, 0);
    }
}
