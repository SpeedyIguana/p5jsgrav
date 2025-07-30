// --- Global Simulation State ---
let isPaused = false;
let showTrails = true;
let showVelocityVectors = false;
let showAccelerationVectors = false;
let showCoM = false;
let maxTrailLength = 150;
let current_G = G;
let current_dt = dt;

// --- Global Color Variables (Read from CSS) ---
let selectedColorValue, velVectorColorValue, accVectorColorValue, comColorValue, bgColorValue;


// --- DOM Element References ---
let pauseButton, resetButton, addPlanetButton, removeButton;
let trailsCheckbox, vectorsVelCheckbox, vectorsAccCheckbox, comCheckbox;
let gravitySlider, gravityValueSpan;
let dtSlider, dtValueSpan;
let trailSlider, trailValueSpan;
let timeValueSpan, keValueSpan, peValueSpan, totalEValueSpan, bodyCountSpan;
let selectedInfoDiv, selectedIdSpan, selectedMassSpan, selectedPosXSpan, selectedPosYSpan, selectedVelXSpan, selectedVelYSpan;
let canvasContainer;

// --- Interaction State ---
let selectedBody = null;
let isDraggingBody = false;
let isPanning = false;
let panStartX = 0, panStartY = 0;

// --- Setup UI Event Listeners ---
function setupInteractions() {
    canvasContainer = select('#canvas-container');

    // --- Get Colors from CSS Variables ---
    let styles = getComputedStyle(document.documentElement);
    selectedColorValue = styles.getPropertyValue('--selected-color').trim();
    velVectorColorValue = styles.getPropertyValue('--vector-vel-color').trim();
    accVectorColorValue = styles.getPropertyValue('--vector-acc-color').trim();
    comColorValue = styles.getPropertyValue('--com-color').trim();
    bgColorValue = styles.getPropertyValue('--bg-color').trim();
    // --- End Get Colors ---


    // Buttons
    pauseButton = select('#pause-button');
    pauseButton.mousePressed(togglePause);
    resetButton = select('#reset-button');
    resetButton.mousePressed(resetSimulation);
    addPlanetButton = select('#add-planet-button');
    addPlanetButton.mousePressed(addRandomPlanet);
    removeButton = select('#remove-button');
    removeButton.mousePressed(removeSelectedBody);

    // Checkboxes
    trailsCheckbox = select('#trails-checkbox');
    trailsCheckbox.changed(() => { showTrails = trailsCheckbox.checked(); if (!showTrails) clearAllTrails(); if(isPaused) redraw(); });
    showTrails = trailsCheckbox.checked();

    vectorsVelCheckbox = select('#vectors-vel-checkbox');
    vectorsVelCheckbox.changed(() => { showVelocityVectors = vectorsVelCheckbox.checked(); if(isPaused) redraw(); });
    showVelocityVectors = vectorsVelCheckbox.checked();

    vectorsAccCheckbox = select('#vectors-acc-checkbox');
    vectorsAccCheckbox.changed(() => { showAccelerationVectors = vectorsAccCheckbox.checked(); if(isPaused) redraw(); });
    showAccelerationVectors = vectorsAccCheckbox.checked();

    comCheckbox = select('#com-checkbox');
    comCheckbox.changed(() => { showCoM = comCheckbox.checked(); if(isPaused) redraw(); });
    showCoM = comCheckbox.checked();

    // Sliders
    gravitySlider = select('#gravity-slider');
    gravityValueSpan = select('#gravity-value');
    gravitySlider.input(() => { current_G = parseFloat(gravitySlider.value()); gravityValueSpan.html(nf(current_G, 1, 1)); });
    current_G = parseFloat(gravitySlider.value()); gravityValueSpan.html(nf(current_G, 1, 1));

    dtSlider = select('#dt-slider');
    dtValueSpan = select('#dt-value');
    dtSlider.input(() => { current_dt = parseFloat(dtSlider.value()); dtValueSpan.html(nf(current_dt, 1, 2)); });
    current_dt = parseFloat(dtSlider.value()); dtValueSpan.html(nf(current_dt, 1, 2));

    trailSlider = select('#trail-slider');
    trailValueSpan = select('#trail-value');
    trailSlider.input(() => { maxTrailLength = parseInt(trailSlider.value()); trailValueSpan.html(maxTrailLength); trimAllTrails(); });
    maxTrailLength = parseInt(trailSlider.value()); trailValueSpan.html(maxTrailLength);

    // Info Display Spans
    timeValueSpan = select('#time-value');
    keValueSpan = select('#ke-value');
    peValueSpan = select('#pe-value');
    totalEValueSpan = select('#total-e-value');
    bodyCountSpan = select('#body-count-value');

    // Selected Info Spans
    selectedInfoDiv = select('#selected-info');
    selectedIdSpan = select('#selected-id');
    selectedMassSpan = select('#selected-mass');
    selectedPosXSpan = select('#selected-pos-x');
    selectedPosYSpan = select('#selected-pos-y');
    selectedVelXSpan = select('#selected-vel-x');
    selectedVelYSpan = select('#selected-vel-y');
    updateSelectedInfoPanel();

    // --- Mouse Controls for Canvas ---
    let canvasElement = canvasContainer.elt;
    canvasElement.addEventListener('wheel', handleWheel, { passive: false });
    canvasElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
}

// --- Interaction Functions ---
function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
        pauseButton.html('Resume');
        noLoop();
    } else {
        pauseButton.html('Pause');
        loop();
    }
}

function handleWheel(event) {
    event.preventDefault();
    let sensitivity = 0.001;
    let scaleFactor = 1.0 - event.deltaY * sensitivity;
    let mouse = screenToWorld(mouseX, mouseY);
    zoom *= scaleFactor;
    zoom = constrain(zoom, 0.05, 20);
    offsetX = mouseX - mouse.x * zoom;
    offsetY = mouseY - mouse.y * zoom;
    if (isPaused) redraw();
}

function handleMouseDown(event) {
    if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) { return; }
    let mouseWorld = screenToWorld(mouseX, mouseY);
    let bodyClicked = null;
    for (let i = bodies.length - 1; i >= 0; i--) {
        if (bodies[i].contains(mouseWorld.x, mouseWorld.y)) { bodyClicked = bodies[i]; break; }
    }
    if (bodyClicked && !bodyClicked.isStatic) {
        isDraggingBody = true;
        selectBody(bodyClicked);
        selectedBody.startDrag();
        panStartX = mouseX; panStartY = mouseY;
        if (!isPaused) togglePause();
        canvasContainer.style('cursor', 'grabbing');
    } else {
        isPanning = true;
        panStartX = mouseX; panStartY = mouseY;
        canvasContainer.style('cursor', 'grabbing');
        if (!bodyClicked) { selectBody(null); }
    }
}

function handleMouseMove(event) {
     if (isDraggingBody && selectedBody) {
         let mouseWorld = screenToWorld(mouseX, mouseY);
         selectedBody.drag(mouseWorld.x, mouseWorld.y);
         if (isPaused) redraw();
     } else if (isPanning) {
         let dx = mouseX - panStartX; let dy = mouseY - panStartY;
         offsetX += dx; offsetY += dy;
         panStartX = mouseX; panStartY = mouseY;
         if (isPaused) redraw();
     }
}

function handleMouseUp(event) {
    if (isDraggingBody && selectedBody) {
        selectedBody.stopDrag();
        if (isPaused) togglePause();
    }
    isDraggingBody = false; isPanning = false;
    canvasContainer.style('cursor', 'grab');
}

function selectBody(body) {
    if (selectedBody) { selectedBody.selected = false; }
    selectedBody = body;
    if (selectedBody) {
        selectedBody.selected = true;
        removeButton.removeAttribute('disabled');
    } else {
        removeButton.attribute('disabled', true);
    }
    updateSelectedInfoPanel();
    if (isPaused) redraw();
}

function removeSelectedBody() {
    if (selectedBody) {
        let indexToRemove = bodies.findIndex(b => b.id === selectedBody.id);
        if (indexToRemove !== -1) {
            console.log(`Removing body ID ${selectedBody.id} at index ${indexToRemove}`);
            // Remove body from main array
            bodies.splice(indexToRemove, 1);

            // Remove corresponding acceleration from accelerations_t array
            if (indexToRemove < accelerations_t.length) { // Safety check
                 console.log(`Splicing accelerations_t at index ${indexToRemove}`);
                 accelerations_t.splice(indexToRemove, 1);
            } else {
                // This case indicates a serious mismatch, try rebuilding
                console.error("CRITICAL: Mismatch between bodies and accelerations_t during removal! Rebuilding accelerations_t.");
                accelerations_t = bodies.map(b => b.acc.copy()); // Rebuild based on current bodies
            }

             // Double-check lengths after removal
             if (bodies.length !== accelerations_t.length) {
                 console.error("CRITICAL: Length mismatch persists after removal! Rebuilding accelerations_t.");
                 accelerations_t = bodies.map(b => b.acc.copy());
             }


            selectBody(null); // Deselect
            updateBodyCount(); // Update UI
            if (isPaused) redraw();
        } else {
             console.warn(`Body ID ${selectedBody.id} not found in bodies array for removal.`);
             selectBody(null); // Deselect anyway
        }
    }
}

function updateTimeDisplay(time) { if(timeValueSpan) timeValueSpan.html(nf(time, 1, 1)); }
function updateEnergyDisplay(ke, pe, totalE) {
    if(keValueSpan) keValueSpan.html(nf(ke, 1, 1));
    if(peValueSpan) peValueSpan.html(nf(pe, 1, 1));
    if(totalEValueSpan) totalEValueSpan.html(nf(totalE, 1, 1));
}
function updateBodyCount() { if(bodyCountSpan) bodyCountSpan.html(bodies.length); }

function updateSelectedInfoPanel() {
    if (selectedBody) {
        selectedIdSpan.html(selectedBody.id);
        selectedMassSpan.html(nf(selectedBody.mass, 0, 1));
        selectedPosXSpan.html(nf(selectedBody.pos.x, 0, 1));
        selectedPosYSpan.html(nf(selectedBody.pos.y, 0, 1));
        selectedVelXSpan.html(nf(selectedBody.vel.x, 0, 2));
        selectedVelYSpan.html(nf(selectedBody.vel.y, 0, 2));
        selectedInfoDiv.style('display', 'block');
    } else {
        selectedIdSpan.html('-'); selectedMassSpan.html('-');
        selectedPosXSpan.html('-'); selectedPosYSpan.html('-');
        selectedVelXSpan.html('-'); selectedVelYSpan.html('-');
        selectedInfoDiv.style('display', 'none');
    }
}