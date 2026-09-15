export class Grid {
    constructor(gl, size = 20, step = 1.0) {
        this.gl = gl;
        this.lineCount = 0;
        this.showGrid = true;
        this.showAxis = true;

        const positions = [];
        const colors = [];

        const half = size / 2;

        for (let i = -half; i <= half; i += step) {
            // Lines parallel to Z axis (along X)
            positions.push(i, 0, -half,  i, 0, half);
            // Lines parallel to X axis (along Z)
            positions.push(-half, 0, i,  half, 0, i);

            // X-axis line (Red)
            if (i === 0) {
                colors.push(0.9, 0.2, 0.2, 1.0,  0.9, 0.2, 0.2, 1.0); // Z=0 line (X axis)
                colors.push(0.2, 0.5, 0.9, 1.0,  0.2, 0.5, 0.9, 1.0); // X=0 line (Z axis)
            } else {
                const c = [0.22, 0.22, 0.22, 1.0];
                colors.push(...c, ...c);
                colors.push(...c, ...c);
            }
        }

        this.lineCount = positions.length / 3;

        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        this.colorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
    }

    render(gl, programInfo, modelMatrix) {
        if (!this.showGrid) return;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexColor, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);

        // Disable normals for grid lines
        if (programInfo.attribLocations.vertexNormal !== -1) {
            gl.disableVertexAttribArray(programInfo.attribLocations.vertexNormal);
        }

        gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, modelMatrix);
        gl.uniform1i(programInfo.uniformLocations.isUnlit, 1);
        gl.uniform1i(programInfo.uniformLocations.isSelected, 0);
        gl.uniform4f(programInfo.uniformLocations.materialColor, 1.0, 1.0, 1.0, 1.0);

        gl.drawArrays(gl.LINES, 0, this.lineCount);
    }
}
