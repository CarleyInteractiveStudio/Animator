// --- WebGL Rendering Logic (Encapsulated) ---
function initWebGL(canvas) {
    const gl = canvas.getContext('webgl');
    if (!gl) {
        console.error('WebGL not supported');
        return null;
    }

    const vertexShaderSource = `
        attribute vec2 a_position;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
    `;

    const fragmentShaderSource = `
        void main() {
            gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // White
        }
    `;

    function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    function createProgram(gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        return program;
    }

    const program = createProgram(gl, vertexShader, fragmentShader);

    const positions = [0.0, 0.5, -0.5, -0.5, 0.5, -0.5];
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    return { gl, program, positionBuffer };
}

function renderWebGL(webglContext, canvas) {
    const { gl, program, positionBuffer } = webglContext;

    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    gl.clearColor(0.13, 0.13, 0.13, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
}

// --- New Layout Engine ---

// 1. Panel Registry: Defines the content of each panel type
const panelRegistry = {
    'jerarquia': {
        title: 'Jerarquía',
        init: (contentArea) => {
            contentArea.innerHTML = '<p>Contenido de Jerarquía...</p>';
        }
    },
    'visor': {
        title: 'Visor 3D',
        init: (contentArea) => {
            const canvas = document.createElement('canvas');
            contentArea.appendChild(canvas);
            const webglContext = initWebGL(canvas);

            function mainLoop() {
                if (webglContext) {
                    renderWebGL(webglContext, canvas);
                }
                requestAnimationFrame(mainLoop);
            }
            requestAnimationFrame(mainLoop);
        }
    },
    'inspector': {
        title: 'Inspector',
        init: (contentArea) => {
            contentArea.innerHTML = '<p>Contenido del Inspector...</p>';
        }
    }
};

// 2. Layout Configuration: A tree structure defining the UI layout
const applicationLayout = {
    docked: {
        type: 'row',
        content: [
            { type: 'component', componentName: 'jerarquia', width: 20 },
            {
                type: 'column',
                content: [
                    { type: 'component', componentName: 'visor', height: 70 },
                    { type: 'component', componentName: 'inspector', height: 30 }
                ],
                width: 80
            }
        ]
    },
    floating: []
};

// --- Main Application Logic ---
const domNodeMap = new WeakMap(); // Maps DOM elements to layout config nodes

function findNode(targetNode, rootNode = applicationLayout.docked) {
    if (rootNode === targetNode) {
        return { parent: null, node: rootNode, index: -1 };
    }
    if (!rootNode.content) {
        return null;
    }
    for (let i = 0; i < rootNode.content.length; i++) {
        const child = rootNode.content[i];
        if (child === targetNode) {
            return { parent: rootNode, node: child, index: i };
        }
        const result = findNode(targetNode, child);
        if (result) {
            return result;
        }
    }
    return null;
}


function removeNodeAndCleanup(nodeToRemove) {
    const found = findNode(nodeToRemove);
    if (!found || !found.parent) return;

    let currentParent = found.parent;
    currentParent.content.splice(found.index, 1);

    while (currentParent) {
        const parentInfo = findNode(currentParent);
        if (currentParent.content && currentParent.content.length === 1) {
            const child = currentParent.content[0];
            child.width = child.width || currentParent.width;
            child.height = child.height || currentParent.height;

            if (parentInfo && parentInfo.parent) {
                parentInfo.parent.content[parentInfo.index] = child;
            } else {
                applicationLayout.docked = child;
            }
        } else if (currentParent.content && currentParent.content.length === 0) {
             if (parentInfo && parentInfo.parent) {
                parentInfo.parent.content.splice(parentInfo.index, 1);
            } else {
                applicationLayout.docked = null;
            }
        }
        currentParent = parentInfo ? parentInfo.parent : null;
    }
}


function updateLayout(draggedNode, targetNode, dropZone) {
    // This function now handles both docking a floating panel and rearranging docked ones.
    const isFloating = applicationLayout.floating.includes(draggedNode);
    if (isFloating) {
        applicationLayout.floating = applicationLayout.floating.filter(p => p !== draggedNode);
    } else {
        removeNodeAndCleanup(draggedNode);
    }

    const { parent: targetParent, node: target, index: targetIndex } = findNode(targetNode);

    // 3. Create a new container that inherits the target's size properties
    const newContainer = {
        type: (dropZone === 'top' || dropZone === 'bottom') ? 'column' : 'row',
        width: target.width,
        height: target.height,
        content: []
    };

    // 4. Clean up the nodes and add them to the new container
    // Remove old size properties
    delete target.width;
    delete target.height;
    delete draggedNode.width;
    delete draggedNode.height;

    // Assign new size properties to divide the space
    const isHorizontal = newContainer.type === 'row';
    draggedNode[isHorizontal ? 'width' : 'height'] = 50;
    target[isHorizontal ? 'width' : 'height'] = 50;

    if (dropZone === 'top' || dropZone === 'left') {
        newContainer.content = [draggedNode, target];
    } else { // bottom or right
        newContainer.content = [target, draggedNode];
    }

    // 5. Replace target with the new container in the tree
    targetParent.content.splice(targetIndex, 1, newContainer);

    // 6. Redraw the entire layout
    const appContainer = document.getElementById('app-container');
    appContainer.innerHTML = ''; // Clear old layout
    buildLayout(applicationLayout.docked, appContainer);
}

function buildLayout(node, parentElement) {
    const element = document.createElement('div');
    domNodeMap.set(element, node); // Associate DOM element with its config node

    if (node.type === 'row' || node.type === 'column') {
        element.className = node.type === 'row' ? 'layout-row' : 'layout-column';
        if (node.width) element.style.flex = `0 0 ${node.width}%`;
        if (node.height) element.style.flex = `0 0 ${node.height}%`;

        node.content.forEach((childNode, index) => {
            buildLayout(childNode, element);

            // Add a splitter after each element except the last one
            if (index < node.content.length - 1) {
                const splitter = document.createElement('div');
                splitter.className = 'layout-splitter';
                element.appendChild(splitter);

                // Attach references to sibling nodes for resizing logic
                splitter.previousNode = childNode;
                splitter.nextNode = node.content[index + 1];

                splitter.addEventListener('mousedown', (e) => {
                    e.preventDefault();

                    const prevElement = splitter.previousElementSibling;
                    const nextElement = splitter.nextElementSibling;
                    const isRow = element.classList.contains('layout-row');

                    const startPos = isRow ? e.clientX : e.clientY;
                    const prevSize = isRow ? prevElement.offsetWidth : prevElement.offsetHeight;
                    const nextSize = isRow ? nextElement.offsetWidth : nextElement.offsetHeight;

                    function onMouseMove(e) {
                        const delta = (isRow ? e.clientX : e.clientY) - startPos;

                        let prevNewSize = prevSize + delta;
                        let nextNewSize = nextSize - delta;

                        const totalSize = prevSize + nextSize;
                        let prevNewPercent = (prevNewSize / totalSize) * 100;
                        let nextNewPercent = (nextNewSize / totalSize) * 100;

                        // Prevent resizing below a minimum size
                        const minSize = 50; // 50px minimum
                        if (prevNewSize < minSize || nextNewSize < minSize) {
                            return;
                        }

                        // Update the data model
                        if (isRow) {
                            splitter.previousNode.width = prevNewPercent;
                            splitter.nextNode.width = nextNewPercent;
                        } else {
                            splitter.previousNode.height = prevNewPercent;
                            splitter.nextNode.height = nextNewPercent;
                        }

                        // Update the live DOM styles
                        prevElement.style.flex = `0 0 ${prevNewPercent}%`;
                        nextElement.style.flex = `0 0 ${nextNewPercent}%`;
                    }

                    function onMouseUp() {
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                    }

                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                });
            }
        });

    } else if (node.type === 'component') {
        element.className = 'panel';
        if (node.width) element.style.flex = `0 0 ${node.width}%`;
        if (node.height) element.style.flex = `0 0 ${node.height}%`;

        const panelInfo = panelRegistry[node.componentName];
        if (panelInfo) {
            const titleBar = document.createElement('div');
            titleBar.className = 'panel-title';
            titleBar.textContent = panelInfo.title;

            // Drag to undock logic
            titleBar.addEventListener('mousedown', (e) => {
                e.preventDefault();

                const draggedNode = domNodeMap.get(element);
                const startX = e.clientX;
                const startY = e.clientY;

                function onInitialMove(moveEvent) {
                    // If mouse moves more than a few pixels, initiate undock
                    if (Math.abs(moveEvent.clientX - startX) > 5 || Math.abs(moveEvent.clientY - startY) > 5) {
                        document.removeEventListener('mousemove', onInitialMove);
                        document.removeEventListener('mouseup', onInitialUp);

                        const rect = element.getBoundingClientRect();
                        removeNodeAndCleanup(draggedNode);

                        const floatingPanelData = {
                            ...draggedNode,
                            x: rect.left,
                            y: rect.top,
                            width: rect.width,
                            height: rect.height,
                        };
                        applicationLayout.floating.push(floatingPanelData);

                        rerender();
                        // The next step will be to implement dragging for the new floating panel
                    }
                }

                function onInitialUp() {
                    document.removeEventListener('mousemove', onInitialMove);
                    document.removeEventListener('mouseup', onInitialUp);
                }

                document.addEventListener('mousemove', onInitialMove);
                document.addEventListener('mouseup', onInitialUp);
            });

            const contentArea = document.createElement('div');
            contentArea.className = 'panel-content';

            element.appendChild(titleBar);
            element.appendChild(contentArea);

            panelInfo.init(contentArea);
        }
    }

    parentElement.appendChild(element);
}

function buildFloatingPanel(panelData, parentElement) {
    const element = document.createElement('div');
    element.className = 'panel floating-panel';
    element.style.left = `${panelData.x}px`;
    element.style.top = `${panelData.y}px`;
    element.style.width = `${panelData.width}px`;
    element.style.height = `${panelData.height}px`;

    const panelInfo = panelRegistry[panelData.componentName];
    if (panelInfo) {
        const titleBar = document.createElement('div');
        titleBar.className = 'panel-title';
        titleBar.textContent = panelInfo.title;

        // --- Drag to Move / Dock Logic ---
        titleBar.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const startX = e.clientX;
            const startY = e.clientY;
            const initialX = panelData.x;
            const initialY = panelData.y;

            const overlay = document.getElementById('dock-overlay');
            let currentDropTarget = null;
            let activeDropZone = null;

            function onMouseMove(moveEvent) {
                // --- Update position for free dragging ---
                panelData.x = initialX + (moveEvent.clientX - startX);
                panelData.y = initialY + (moveEvent.clientY - startY);
                element.style.left = `${panelData.x}px`;
                element.style.top = `${panelData.y}px`;

                // --- Check for docking opportunities ---
                 let dropTarget = null;
                 const allPanels = document.querySelectorAll('.panel:not(.floating-panel)');
                 for (const otherPanel of allPanels) {
                     const rect = otherPanel.getBoundingClientRect();
                     if (moveEvent.clientX > rect.left && moveEvent.clientX < rect.right && moveEvent.clientY > rect.top && moveEvent.clientY < rect.bottom) {
                         dropTarget = otherPanel;
                         break;
                     }
                 }

                 if (dropTarget !== currentDropTarget) {
                     if (dropTarget) {
                         showOverlay(dropTarget);
                     } else {
                         hideOverlay();
                     }
                     currentDropTarget = dropTarget;
                 }

                 if (currentDropTarget) {
                     activeDropZone = getActiveDropZone(moveEvent, currentDropTarget.getBoundingClientRect());
                     highlightDropZone(activeDropZone);
                 }
            }

            function onMouseUp() {
                if (currentDropTarget && activeDropZone && activeDropZone !== 'center') {
                    const targetNode = domNodeMap.get(currentDropTarget);
                    updateLayout(panelData, targetNode, activeDropZone);
                    rerender(); // Re-render to show the new docked layout
                }
                hideOverlay();
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        const contentArea = document.createElement('div');
        contentArea.className = 'panel-content';

        element.appendChild(titleBar);
        element.appendChild(contentArea);

        panelInfo.init(contentArea);
    }

    parentElement.appendChild(element);
}

function rerender() {
    const appContainer = document.getElementById('app-container');
    appContainer.innerHTML = ''; // Clear the entire layout
    if (applicationLayout.docked) {
        buildLayout(applicationLayout.docked, appContainer);
    }
    applicationLayout.floating.forEach(panelData => {
        buildFloatingPanel(panelData, appContainer);
    });
}

window.onload = () => {
    rerender();
};


function showOverlay(targetPanel) {
    const overlay = document.getElementById('dock-overlay');
    const rect = targetPanel.getBoundingClientRect();
    overlay.classList.remove('hidden');

    // Position the overlay exactly on top of the target panel
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;

    // Position drop zones (simplified example)
    const center = overlay.querySelector('[data-zone="center"]');
    center.style.left = '25%'; center.style.top = '25%'; center.style.width = '50%'; center.style.height = '50%';

    const top = overlay.querySelector('[data-zone="top"]');
    top.style.left = '25%'; top.style.top = '0'; top.style.width = '50%'; top.style.height = '25%';

    const bottom = overlay.querySelector('[data-zone="bottom"]');
    bottom.style.left = '25%'; bottom.style.top = '75%'; bottom.style.width = '50%'; bottom.style.height = '25%';

    const left = overlay.querySelector('[data-zone="left"]');
    left.style.left = '0'; left.style.top = '25%'; left.style.width = '25%'; left.style.height = '50%';

    const right = overlay.querySelector('[data-zone="right"]');
    right.style.left = '75%'; right.style.top = '25%'; right.style.width = '25%'; right.style.height = '50%';
}

function hideOverlay() {
    const overlay = document.getElementById('dock-overlay');
    overlay.classList.add('hidden');
}

function getActiveDropZone(mouseEvent, targetRect) {
    // Simplified logic: determine which quadrant the mouse is in
    const relX = (mouseEvent.clientX - targetRect.left) / targetRect.width;
    const relY = (mouseEvent.clientY - targetRect.top) / targetRect.height;

    if (relX > 0.25 && relX < 0.75 && relY > 0.25 && relY < 0.75) return 'center';
    if (relY < 0.25) return 'top';
    if (relY > 0.75) return 'bottom';
    if (relX < 0.25) return 'left';
    if (relX > 0.75) return 'right';

    return null;
}

function highlightDropZone(activeZone) {
    const overlay = document.getElementById('dock-overlay');
    overlay.querySelectorAll('.drop-zone').forEach(zone => {
        if (zone.dataset.zone === activeZone) {
            zone.style.backgroundColor = 'rgba(0, 150, 255, 0.5)';
        } else {
            zone.style.backgroundColor = 'rgba(0, 150, 255, 0.3)';
        }
    });
}
