let bodies = [];
let nextBodyId = 0;
let simulationTime = 0;
let zoom = 1.0;
let offsetX = 0;
let offsetY = 0;
let stars = [];
const NUM_STARS = 300;
let accelerations_t = []; // Stores a(t) for each body

function setup() {
    let canvasContainer = select('#canvas-container');
    let canvas = createCanvas(800, 600);
    canvas.parent(canvasContainer);
    pixelDensity(1);
    for (let i = 0; i < NUM_STARS; i++) { stars.push({ x: random(-width * 2, width * 2), y: random(-height * 2, height * 2), size: random(0.5, 2), brightness: random(50, 150) }); }
    offsetX = width / 2; offsetY = height / 2;
    setupInteractions();
    initializeBodies();
    updateBodyCount();
}

function initializeBodies() {
    simulationTime = 0; nextBodyId = 0; bodies = [];
    // --- Example Bodies ---
    let sun = new Body(0, 0, 0, 0, 1000, 'yellow', true, nextBodyId++); bodies.push(sun);
    let planetDist = 200; let planetMass = 10; let planetVelMag = sqrt(current_G * sun.mass / planetDist);
    let p1 = new Body(planetDist, 0, 0, planetVelMag, planetMass, 'cyan', false, nextBodyId++); bodies.push(p1);
    let planetDist2 = 300; let planetMass2 = 15; let planetVelMag2 = sqrt(current_G * sun.mass / planetDist2) * 0.8;
    let p2 = new Body(0, -planetDist2, planetVelMag2, 0, planetMass2, 'lightgreen', false, nextBodyId++); bodies.push(p2);
    // --- End Example Bodies ---

    // --- Robust Initialization of accelerations_t ---
    accelerations_t = bodies.map(b => {
        // make sure b.acc exists and is a vector before copying
        if (b.acc && typeof b.acc.copy === 'function') {
            return b.acc.copy();
        } else {
            console.error(`Body ID ${b.id} has invalid acc during init!`, b.acc);
            return createVector(0, 0); // Return a default vector
        }
    });
    console.log(`Initialized ${bodies.length} bodies and ${accelerations_t.length} acc_t entries.`);
    // --- End Robust Initialization ---

    updateTimeDisplay(simulationTime); updateSelectedInfoPanel(); updateBodyCount(); calculateAndDisplayEnergy(); selectBody(null);
}


function draw() {
    background(bgColorValue);

    // Draw Background Stars 
    push(); translate(offsetX, offsetY); scale(zoom); fill(200); noStroke(); for (let star of stars) { fill(star.brightness); ellipse(star.x, star.y, star.size / zoom, star.size / zoom); } pop();
    // Apply Camera Transformations 
    push(); translate(offsetX, offsetY); scale(zoom);

    if (!isPaused) {
        // --- Physics Update ---

        // make sure accelerations_t array is synchronized 
        if (accelerations_t.length !== bodies.length) { console.warn(`Resyncing accelerations_t (${accelerations_t.length} vs ${bodies.length} bodies)`); accelerations_t = bodies.map(b => (b.acc && typeof b.acc.copy === 'function') ? b.acc.copy() : createVector(0,0)); if (accelerations_t.length !== bodies.length) { console.error("CRITICAL: Failed to resync accelerations_t!"); } }

        // 0. Store current accelerations a(t) 
        for(let i = 0; i < bodies.length; i++) { if (bodies[i] && bodies[i].acc && accelerations_t[i] && typeof bodies[i].acc.copy === 'function') { accelerations_t[i].set(bodies[i].acc); } else { console.error(`Error copying acceleration for body index ${i}!`); if (!accelerations_t[i]) accelerations_t[i] = createVector(0,0); else accelerations_t[i].set(0,0); } }

        // 1. Update positions r(t) -> r(t+dt) using v(t) and a(t) 
        for (let body of bodies) { body.updatePosition(); }

        // 2. Reset current accelerations to zero 
        for (let body of bodies) { body.resetAcceleration(); }

        // 3. Calculate forces for new positions r(t+dt) -> new a(t+dt)
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                if (bodies[i] && bodies[j]) {
                    let force_i = bodies[i].attract(bodies[j]);
                    // Log details occasionally for the interaction between body 0 and body 1 (if they exist)
                    if (!bodies[i].isStatic && !bodies[j].isStatic && frameCount % 120 === 1 && i === 0 && j === 1) {
                         let dist = p5.Vector.sub(bodies[j].pos, bodies[i].pos).mag();
                         console.log(`Frame ${frameCount}: Force on Body ${bodies[i].id} by Body ${bodies[j].id}`);
                         console.log(`   Dist: ${dist.toFixed(1)}, G: ${current_G}`);
                         console.log(`   Force Mag: ${force_i.mag().toFixed(4)}, Vec: (${force_i.x.toFixed(4)}, ${force_i.y.toFixed(4)})`);
                    }
                    // --- End Logging ---

                    let force_j = force_i.copy().mult(-1);
                    bodies[i].applyForce(force_i); // Adds F_i/m_i to bodies[i].acc
                    bodies[j].applyForce(force_j); // Adds F_j/m_j to bodies[j].acc
                }
            }
        }

        if (frameCount % 120 === 1) {
            console.log(`--- Frame ${frameCount} Accelerations (a(t+dt)) ---`);
            for(let k=0; k < bodies.length; k++){
                if(bodies[k] && !bodies[k].isStatic) { // Log only for non-static bodies
                    // Check if acc is valid before logging
                    let accX = bodies[k].acc && typeof bodies[k].acc.x !== 'undefined' ? bodies[k].acc.x.toFixed(5) : 'Invalid';
                    let accY = bodies[k].acc && typeof bodies[k].acc.y !== 'undefined' ? bodies[k].acc.y.toFixed(5) : 'Invalid';
                    console.log(` Body ${bodies[k].id} acc: (${accX}, ${accY})`);
                }
            }
            console.log(`------------------------------------------`);
        }
        // --- End Logging ---


        // 4. Update velocities v(t) -> v(t+dt) using v(t), stored a(t), and new a(t+dt) 
        for (let i = 0; i < bodies.length; i++) { if (bodies[i] && accelerations_t[i]) { bodies[i].updateVelocity(accelerations_t[i]); } else { console.error(`Skipping velocity update for body index ${i} due to invalid state.`); } }

        simulationTime += current_dt; updateTimeDisplay(simulationTime); calculateAndDisplayEnergy(); updateSelectedInfoPanel();
    }

    // --- Drawing Simulation Elements --- 
    if (showCoM && bodies.length > 0) { let com = calculateCoM(); push(); fill(comColorValue); stroke(255); strokeWeight(1 / zoom); let markerSize = 8 / zoom; line(com.x - markerSize, com.y, com.x + markerSize, com.y); line(com.x, com.y - markerSize, com.x, com.y + markerSize); pop(); }
    for (let body of bodies) { body.show(0, 0, zoom); }

    pop(); // Restore default drawing state
}

// --- Helper Functions --- 
function screenToWorld(screenX, screenY) { let worldX = (screenX - offsetX) / zoom; let worldY = (screenY - offsetY) / zoom; return createVector(worldX, worldY); }
function worldToScreen(worldX, worldY) { let screenX = worldX * zoom + offsetX; let screenY = worldY * zoom + offsetY; return createVector(screenX, screenY); }
function calculateCoM() { let totalMass = 0; let weightedPosSum = createVector(0, 0); for (let body of bodies) { if(body.isStatic) continue; totalMass += body.mass; weightedPosSum.add(p5.Vector.mult(body.pos, body.mass)); } if (totalMass === 0) return createVector(0, 0); return p5.Vector.div(weightedPosSum, totalMass); }
function calculateAndDisplayEnergy() { let totalKE = 0; let totalPE = 0; for (let body of bodies) { totalKE += body.kineticEnergy(); } for (let i = 0; i < bodies.length; i++) { for (let j = i + 1; j < bodies.length; j++) { totalPE += bodies[i].potentialEnergyWith(bodies[j]); } } updateEnergyDisplay(totalKE, totalPE, totalKE + totalPE); }

// --- Functions Called by interaction.js ---
function resetSimulation() { console.log("Resetting simulation..."); zoom = 1.0; offsetX = width / 2; offsetY = height / 2; initializeBodies(); if (isPaused) { isPaused = false; pauseButton.html('Pause'); loop(); } else { loop(); } redraw(); }
function addRandomPlanet() {
    console.log("Adding random planet...");
    let angle = random(TWO_PI); let viewCenter = screenToWorld(width / 2, height / 2); let maxSpawnDist = min(width, height) * 0.4 / zoom;
    let dist = random(maxSpawnDist * 0.2, maxSpawnDist);
    let x = viewCenter.x + cos(angle) * dist; let y = viewCenter.y + sin(angle) * dist;
    let centralMass = (bodies.length > 0 && bodies[0]) ? bodies[0].mass : 1000;
    let speedMag = sqrt(current_G * centralMass / max(dist, 1)); // Using multiplier 1.0
    let vx = -sin(angle) * speedMag; let vy = cos(angle) * speedMag;
    let mass = random(1, 15); let col = color(random(100, 255), random(100, 255), random(100, 255));
    let newPlanet = new Body(x, y, vx, vy, mass, col, false, nextBodyId++);
    bodies.push(newPlanet);
    accelerations_t.push(createVector(0,0));
    console.log(`Added body ID ${newPlanet.id}. Bodies: ${bodies.length}, Acc_t: ${accelerations_t.length}`);
    updateBodyCount();
    if (isPaused) redraw();
}
function clearAllTrails() { console.log("Clearing trails..."); for (let body of bodies) { body.clearTrail(); } if (isPaused) redraw(); }
function trimAllTrails() { for (let body of bodies) { while (body.trail.length > maxTrailLength && body.trail.length > 0) { body.trail.shift(); } } if (isPaused) redraw(); }