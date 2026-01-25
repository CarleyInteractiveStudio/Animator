
function onMouseDown(event) {
    if (event.button !== 0) return; // Only handle left clicks

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, 45 * Math.PI / 180, canvas.clientWidth / canvas.clientHeight, 0.1, 100.0);
    const viewMatrix = camera.getViewMatrix();

    if (Engine.selectedGameObject) {
        selectedAxis = pickGizmoAxis(webglContext, canvas, gizmo, projectionMatrix, viewMatrix, x, y);
        if (selectedAxis) {
            isDragging = true;
            initialMousePos = { x, y };
            vec3.copy(initialObjectPos, Engine.selectedGameObject.transform.position);
            gizmo.setActiveAxis(selectedAxis);
            return;
        }
    }

    const pickedId = pickObject(webglContext, canvas, Engine.scene, projectionMatrix, viewMatrix, x, y);
    if (pickedId !== -1) {
        Engine.selectedGameObject = Engine.scene.getGameObjectById(pickedId);
        gizmo.isVisible = true;
    } else {
        Engine.selectedGameObject = null;
        gizmo.isVisible = false;
    }
    gizmo.setActiveAxis(null);
}

function onMouseUp(event) {
    if (event.button !== 0) return;
    isDragging = false;
    selectedAxis = null;
    gizmo.setActiveAxis(null);
}

function onMouseMove(event) {
    if (!isDragging || !Engine.selectedGameObject || !selectedAxis) return;

    const rect = canvas.getBoundingClientRect();
    const currentMousePos = { x: event.clientX - rect.left, y: event.clientY - rect.top };

    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, 45 * Math.PI / 180, canvas.clientWidth / canvas.clientHeight, 0.1, 100.0);
    const viewMatrix = camera.getViewMatrix();
    const viewProjMatrix = mat4.multiply(mat4.create(), projectionMatrix, viewMatrix);

    const delta = projectMouseToWorld(currentMousePos, initialMousePos, initialObjectPos, selectedAxis, viewProjMatrix, canvas);

    vec3.add(Engine.selectedGameObject.transform.position, initialObjectPos, delta);
}

function projectMouseToWorld(currentMouse, initialMouse, objectPos, axis, viewProj, canvas) {
    const objectScreenPos = vec3.transformMat4(vec3.create(), objectPos, viewProj);
    objectScreenPos[0] = (objectScreenPos[0] + 1) * 0.5 * canvas.width;
    objectScreenPos[1] = (1 - objectScreenPos[1]) * 0.5 * canvas.height;

    const axisDirection = vec3.create();
    if (axis === 1) vec3.set(axisDirection, 1, 0, 0); // X
    if (axis === 2) vec3.set(axisDirection, 0, 1, 0); // Y
    if (axis === 3) vec3.set(axisDirection, 0, 0, 1); // Z

    const axisScreen = vec3.transformMat4(vec3.create(), vec3.add(vec3.create(), objectPos, axisDirection), viewProj);
    axisScreen[0] = (axisScreen[0] + 1) * 0.5 * canvas.width;
    axisScreen[1] = (1 - axisScreen[1]) * 0.5 * canvas.height;

    const axisVectorScreen = vec3.subtract(vec3.create(), axisScreen, objectScreenPos);
    vec3.normalize(axisVectorScreen, axisVectorScreen);

    const mouseVector = vec3.fromValues(currentMouse.x - initialMouse.x, currentMouse.y - initialMouse.y, 0);
    const dotProduct = vec3.dot(mouseVector, axisVectorScreen);

    const worldAxis = vec3.create();
    const modelMatrix = Engine.selectedGameObject.getModelMatrix();
    vec3.transformMat4(worldAxis, axisDirection, modelMatrix);
    vec3.subtract(worldAxis, worldAxis, Engine.selectedGameObject.transform.position);
    vec3.normalize(worldAxis, worldAxis);

    // This is a simplification. A more robust solution would involve unprojecting
    // the mouse movement onto a plane defined by the axis and the camera.
    // For now, we scale based on distance and a magic factor.
    const distance = vec3.distance(camera.position, objectPos);
    const scaleFactor = 0.01 * distance;

    return vec3.scale(vec3.create(), axisDirection, dotProduct * scaleFactor);
}
