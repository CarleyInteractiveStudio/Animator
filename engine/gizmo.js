import { mat4 } from './math.js';

export class Gizmo {
    constructor(gl) {
        this.gl = gl;
        this.mode = 'translate'; // 'translate', 'rotate', 'scale'
        this.activeAxis = null;

        this.initGizmoMeshes(gl);
    }

    initGizmoMeshes(gl) {
        const len = 1.4;

        const xVertices = [0, 0, 0,  len, 0, 0];
        const yVertices = [0, 0, 0,  0, len, 0];
        const zVertices = [0, 0, 0,  0, 0, len];

        const xColors = [1, 0.2, 0.2, 1,  1, 0.2, 0.2, 1];
        const yColors = [0.2, 1, 0.2, 1,  0.2, 1, 0.2, 1];
        const zColors = [0.2, 0.5, 1, 1,  0.2, 0.5, 1, 1];

        this.xBuffer = this.createLineBuffer(gl, xVertices, xColors);
        this.yBuffer = this.createLineBuffer(gl, yVertices, yColors);
        this.zBuffer = this.createLineBuffer(gl, zVertices, zColors);
    }

    createLineBuffer(gl, vertices, colors) {
        const vBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        const cBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, cBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

        return { vBuf, cBuf, count: 2 };
    }

    render(gl, programInfo, targetObject, viewMatrix, projectionMatrix) {
        if (!targetObject) return;

        gl.disable(gl.DEPTH_TEST);
        gl.useProgram(programInfo.program);

        const gizmoMatrix = mat4.create();
        mat4.fromTranslation(gizmoMatrix, targetObject.transform.position);

        gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);
        gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, gizmoMatrix);
        gl.uniform4f(programInfo.uniformLocations.tintColor, 1.0, 1.0, 1.0, 1.0);

        const drawAxis = (buf) => {
            gl.bindBuffer(gl.ARRAY_BUFFER, buf.vBuf);
            gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

            if (programInfo.attribLocations.vertexColor !== -1) {
                gl.bindBuffer(gl.ARRAY_BUFFER, buf.cBuf);
                gl.vertexAttribPointer(programInfo.attribLocations.vertexColor, 4, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);
            }

            gl.drawArrays(gl.LINES, 0, buf.count);
        };

        drawAxis(this.xBuffer);
        drawAxis(this.yBuffer);
        drawAxis(this.zBuffer);

        gl.enable(gl.DEPTH_TEST);
    }
}
