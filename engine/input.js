const keys = {};
let mouseDelta = { x: 0, y: 0 };
let isRightMouseDown = false;

function onKeyDown(event) {
    keys[event.key] = true;
}

function onKeyUp(event) {
    keys[event.key] = false;
}

function onMouseMove(event) {
    mouseDelta.x += event.movementX;
    mouseDelta.y += event.movementY;
}

function onMouseDown(event) {
    if (event.button === 2) { // Right mouse button
        isRightMouseDown = true;
        event.preventDefault(); // Prevent context menu
    }
}

function onMouseUp(event) {
    if (event.button === 2) { // Right mouse button
        isRightMouseDown = false;
    }
}


export const Input = {
    initialize: (canvas) => {
        // Prevent context menu on the canvas
        canvas.addEventListener('contextmenu', (event) => event.preventDefault());

        canvas.addEventListener('mousedown', (event) => {
            // We only lock pointer on left click now
            if (event.button === 0) {
                canvas.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === canvas) {
                document.addEventListener('keydown', onKeyDown);
                document.addEventListener('keyup', onKeyUp);
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mousedown', onMouseDown);
                document.addEventListener('mouseup', onMouseUp);
            } else {
                document.removeEventListener('keydown', onKeyDown);
                document.removeEventListener('keyup', onKeyUp);
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mousedown', onMouseDown);
                document.removeEventListener('mouseup', onMouseUp);
                // Clear all input states when losing focus
                for (const key in keys) {
                    keys[key] = false;
                }
                isRightMouseDown = false;
            }
        });
    },
    isKeyDown: (key) => {
        return keys[key] || false;
    },
    isRightMouseButtonDown: () => {
        return isRightMouseDown;
    },
    getMouseDelta: () => {
        const delta = { ...mouseDelta };
        // Reset after getting the value
        mouseDelta = { x: 0, y: 0 };
        return delta;
    }
};
