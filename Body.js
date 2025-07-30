// Represents a celestial body

class Body {
    constructor(x, y, vx, vy, mass, color = 'white', isStatic = false, id = -1) {
        this.id = id;
        this.mass = mass;
        this.radius = pow(this.mass, 1/3) * 1.5;
        this.color = color;
        this.isStatic = isStatic;

        this.pos = createVector(x, y); // r(t)
        this.vel = createVector(vx, vy); // v(t)
        this.acc = createVector(0, 0);  // a(t) - Acceleration from PREVIOUS step's force calculation
                                        // This will be updated to a(t+dt) AFTER new forces are applied

        // this.accPrev = createVector(0, 0);

        this.trail = [];
        this.selected = false;
        this.beingDragged = false;
    }

    // --- Physics Methods ---

    attract(other) {
        if (this.isStatic) return createVector(0, 0);
        let force = p5.Vector.sub(other.pos, this.pos);
        let distanceSq = force.magSq();
        let softening = 5 * 5;
        distanceSq = max(distanceSq, softening);
        let distance = sqrt(distanceSq);
        // Use global G
        let strength = (current_G * this.mass * other.mass) / distanceSq;
        force.setMag(strength);
        return force;
    }

    // Stores the force temporarily before the main update loop uses it
    applyForce(force) {
        if (this.isStatic) return;
        // Directly calculate acceleration component and add to current acc
        let f = force.copy();
        f.div(this.mass);
        this.acc.add(f); // Accumulate F/m into this.acc
                         // Before the physics step, this holds a(t)
                         // After the force calculation loop, this will hold a(t+dt)
    }

    // Resets acceleration before new forces are calculated for the next step
    resetAcceleration() {
         this.acc.set(0, 0);
    }


    // Velocity Verlet Step 1: Update position
    // Needs r(t), v(t), a(t)
    // Updates r(t) to r(t+dt)
    updatePosition() {
        if (this.isStatic || this.beingDragged) return;

        // Directly use current velocity v(t) and current acceleration a(t)
        let acc_t = this.acc; // This is a(t) BEFORE new forces are calculated

        let dtSq = current_dt * current_dt;
        let vel_dt = p5.Vector.mult(this.vel, current_dt);       // v(t) * dt
        let acc_dtSq_half = p5.Vector.mult(acc_t, 0.5 * dtSq); // 0.5 * a(t) * dt^2

        // r(t+dt) = r(t) + v(t)dt + 0.5a(t)dt^2
        this.pos.add(vel_dt);
        this.pos.add(acc_dtSq_half);

        // Update trail
        if (showTrails) {
            this.trail.push({pos: this.pos.copy(), speed: this.vel.mag()});
            while (this.trail.length > maxTrailLength) { this.trail.shift(); }
        } else { this.clearTrail(); }
    }

    // Velocity Verlet Step 2: Update velocity
    // Needs v(t), a(t), and a(t+dt)
    // Updates v(t) to v(t+dt)
    // IMPORTANT: WE Call this AFTER new forces for r(t+dt) have been calculated and stored in this.acc (which is now a(t+dt))
    // We also need a(t), which was the value of this.acc BEFORE the new forces were calculated.
    updateVelocity(acc_t) { // Pass the acceleration from the start of the step, a(t)
        if (this.isStatic || this.beingDragged) return;

        // Current this.acc holds a(t+dt) calculated from forces at r(t+dt)
        let acc_t_plus_dt = this.acc;

        if (!acc_t || typeof acc_t.copy !== 'function') {
             console.error(`Body ${this.id}: Invalid acc_t received in updateVelocity!`, acc_t);
             acc_t = createVector(0,0); // Use zero vector as fallback
        }
         if (!acc_t_plus_dt || typeof acc_t_plus_dt.copy !== 'function') {
             console.error(`Body ${this.id}: Invalid this.acc (acc_t_plus_dt) in updateVelocity!`, acc_t_plus_dt);
             acc_t_plus_dt = createVector(0,0); // Use zero vector as fallback
         }
        // console.log(`Body ${this.id} updateVel: acc_t=(${acc_t.x?.toFixed(3)}, ${acc_t.y?.toFixed(3)}), acc_t+dt=(${acc_t_plus_dt.x?.toFixed(3)}, ${acc_t_plus_dt.y?.toFixed(3)})`); // Optional detailed log
        // --- End Fix ---


        // v(t+dt) = v(t) + 0.5 * (a(t) + a(t+dt)) * dt
        // Use p5.Vector.add() safely now
        let avgAcc = p5.Vector.add(acc_t, acc_t_plus_dt); // a(t) + a(t+dt)

        // Check if avgAcc is valid before mult/add
        if (!avgAcc || typeof avgAcc.mult !== 'function') {
             console.error(`Body ${this.id}: Invalid avgAcc calculated!`, avgAcc);
             return; // Skip velocity update if calculation failed
        }

        avgAcc.mult(0.5 * current_dt);                  // * 0.5 * dt

        this.vel.add(avgAcc); // Add to v(t) to get v(t+dt)
    }


    // --- Drawing Methods (show, drawVector) ---
    show(offsetX, offsetY, currentZoom) {
        push(); translate(offsetX, offsetY); scale(currentZoom);
        if (showTrails && this.trail.length > 1) {
            strokeWeight(1 / currentZoom); let maxSpeed = 15;
            for (let i = 0; i < this.trail.length - 1; i++) {
                 let segmentSpeed = this.trail[i].speed;
                 let speedRatio = constrain(segmentSpeed / maxSpeed, 0, 1);
                 let trailColor = lerpColor(color(0, 0, 255), color(255, 0, 0), speedRatio);
                 let alpha = map(i, 0, this.trail.length -1, 0, 150);
                 stroke(red(trailColor), green(trailColor), blue(trailColor), alpha);
                 line(this.trail[i].pos.x, this.trail[i].pos.y, this.trail[i+1].pos.x, this.trail[i+1].pos.y);
             }
        }
        noStroke(); fill(this.color); ellipse(this.pos.x, this.pos.y, this.radius * 2);
        if (this.selected) {
            noFill(); strokeWeight(2 / currentZoom); stroke(selectedColorValue);
            ellipse(this.pos.x, this.pos.y, this.radius * 2 + 10 / currentZoom);
        }
        if (showVelocityVectors) this.drawVector(this.vel, velVectorColorValue, 10, currentZoom);
        if (showAccelerationVectors) this.drawVector(this.acc, accVectorColorValue, 500, currentZoom); // This shows a(t+dt)
        pop();
    }
    drawVector(vec, vecColor, scaleFactor, currentZoom) {
         if (!vecColor) { vecColor = 'magenta'; }
        push(); stroke(vecColor); strokeWeight(2 / currentZoom); fill(vecColor);
        translate(this.pos.x, this.pos.y);
        line(0, 0, vec.x * scaleFactor, vec.y * scaleFactor);
        let arrowSize = 5 / currentZoom;
        if (vec.mag() * scaleFactor >= arrowSize) {
             push(); rotate(vec.heading()); translate(vec.mag() * scaleFactor - arrowSize, 0);
             triangle(0, arrowSize / 2, 0, -arrowSize / 2, arrowSize, 0);
             pop();
        }
        pop();
    }

    // --- Other Methods (clearTrail, contains, startDrag, drag, stopDrag, kineticEnergy, potentialEnergyWith) ---
    clearTrail() { this.trail = []; }
    contains(worldX, worldY) { let d = dist(worldX, worldY, this.pos.x, this.pos.y); return d < this.radius; }
    startDrag() { if (this.isStatic) return; this.beingDragged = true; this.vel.set(0, 0); this.acc.set(0, 0); /*this.accPrev.set(0,0);*/ } // Removed accPrev
    drag(worldX, worldY) { if (this.beingDragged) { this.pos.set(worldX, worldY); this.clearTrail(); } }
    stopDrag() { this.beingDragged = false; }
    kineticEnergy() { if (this.isStatic) return 0; let speedSq = this.vel.magSq(); return 0.5 * this.mass * speedSq; }
    potentialEnergyWith(other) {
       if (this.isStatic && other.isStatic) return 0;
       let distanceVec = p5.Vector.sub(other.pos, this.pos); let distanceSq = distanceVec.magSq();
       let softening = 5*5; distanceSq = max(distanceSq, softening); let distance = sqrt(distanceSq);
       if (distance === 0) return 0;
       return -current_G * this.mass * other.mass / distance;
    }
}