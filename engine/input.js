const keys = {};
let mouseDelta = { x: 0, y: 0 };

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

export const Input = {
    initialize: (canvas) => {
        canvas.addEventListener('click', () => {
            canvas.requestPointerLock();
        });

        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === canvas) {
                document.addEventListener('keydown', onKeyDown);
                document.addEventListener('keyup', onKeyUp);
                document.addEventListener('mousemove', onMouseMove);
            } else {
                document.removeEventListener('keydown', onKeyDown);
                document.removeEventListener('keyup', onKeyUp);
                document.removeEventListener('mousemove', onMouseMove);
                // Clear key state when losing focus
                for (const key in keys) {
                    keys[key] = false;
                }
            }
        });
    },
    isKeyDown: (key) => {
        return keys[key] || false;
    },
    getMouseDelta: () => {
        const delta = { ...mouseDelta };
        // Reset after getting the value
        mouseDelta = { x: 0, y: 0 };
        return delta;
    }
};
