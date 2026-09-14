const keys = {};
let mouseDelta = { x: 0, y: 0 };
let isRightMouseDown = false;
let lastMousePos = { x: 0, y: 0 };

function onKeyDown(event) {
    keys[event.key.toLowerCase()] = true;
}

function onKeyUp(event) {
    keys[event.key.toLowerCase()] = false;
}

export const Input = {
    initialize: (canvas) => {
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 2) { // Right click
                isRightMouseDown = true;
                lastMousePos = { x: e.clientX, y: e.clientY };
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 2) {
                isRightMouseDown = false;
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (isRightMouseDown) {
                const dx = e.clientX - lastMousePos.x;
                const dy = e.clientY - lastMousePos.y;
                mouseDelta.x += dx;
                mouseDelta.y += dy;
                lastMousePos = { x: e.clientX, y: e.clientY };
            }
        });
    },
    isKeyDown: (key) => {
        return keys[key.toLowerCase()] || false;
    },
    isRightMouseDown: () => {
        return isRightMouseDown;
    },
    getMouseDelta: () => {
        const delta = { ...mouseDelta };
        mouseDelta = { x: 0, y: 0 };
        return delta;
    }
};
