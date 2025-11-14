module.exports = {
    run: run
};

function run(room, struct) {
    visualizeController(room);
    visualizeSpawns(struct);
    visualizeCPU(room);
}

/** visualize room controller: RCL, upgrade progress, rate, time est */
function visualizeController(room) {
    const controller = room.controller;
    if (!controller || !controller.my) return;

    if (!room.memory.controllerTracking) {
        room.memory.controllerTracking = {
            lastProgress: controller.progress || 0,
            rates: [] // circular buffer for deltas
        };
    }

    // calculate rate (progress per tick)
    const tracking = room.memory.controllerTracking;
    const delta = controller.progress - tracking.lastProgress;
    tracking.rates.push(delta);
    if (tracking.rates.length > 10) {
        tracking.rates.shift(); // Keep only last 10
    }

    const avgRate = tracking.rates.reduce((a, b) => a + b, 0) / tracking.rates.length;

    // update tracking for next tick
    tracking.lastProgress = controller.progress;

    const level = controller.level;
    const progress = controller.progress || 0;
    const total = controller.progressTotal || 1; // avoid div0 here
    const ratio = progress / total;
    const percent = Math.floor(ratio * 100);
    const remaining = total - progress;
    let timeEst = 'Stalled';
    if (avgRate > 0) {
        const ticksLeft = Math.ceil(remaining / avgRate);
        timeEst = `${ticksLeft} ticks`;
        const ticksPerHour = 3600 / 2.5;  // 1440
        const ticksPerMinute = 60 / 2.5;  // 24
        if (ticksLeft > ticksPerHour) {
            timeEst = `>${Math.floor(ticksLeft / ticksPerHour)}h`;
        } else if (ticksLeft > ticksPerMinute) {
            timeEst = `${Math.floor(ticksLeft / ticksPerMinute)} min`;
        }
    }

    // color for progress bar and percent (red -> yellow -> green)
    let color;
    if (ratio < 0.5) {
        const t = ratio / 0.5;
        const r = 255;
        const g = Math.floor(170 * t);
        const b = 0;
        color = `rgb(${r},${g},${b})`;
    } else {
        const t = (ratio - 0.5) / 0.5;
        const r = Math.floor(255 * (1 - t));
        const g = 170 + Math.floor(85 * t);
        const b = 0;
        color = `rgb(${r},${g},${b})`;
    }

    const posX = controller.pos.x + 1;
    const posY = controller.pos.y;

    const visual = room.visual;

    visual.text(
        `RCL ${level}`,
        posX,
        posY - 1.2,
        {
            align: 'left',
            opacity: 1.0,
            color: '#ffffff',
            stroke: '#000000',
            strokeWidth: 0.08,
            font: '0.8 monospace'
        }
    );

    visual.text(
        `+${Math.round(avgRate)} energy/tick`,
        posX,
        posY - 0.4,
        {
            align: 'left',
            opacity: 1.0,
            color: '#aaaaaa',
            stroke: '#000000',
            strokeWidth: 0.08,
            font: '0.7 monospace'
        }
    );

    visual.text(
        `Next: ${timeEst}`,
        posX,
        posY + 0.4,
        {
            align: 'left',
            opacity: 1.0,
            color: '#aaaaaa',
            stroke: '#000000',
            strokeWidth: 0.08,
            font: '0.7 monospace'
        }
    );

    const barWidth = 4;
    const filledWidth = ratio * barWidth;
    const barY = posY + 1.2;
    visual.line(
        posX, barY,
        posX + filledWidth, barY,
        { color, width: 0.25, opacity: 1.0 }
    );
    visual.line(
        posX + filledWidth, barY,
        posX + barWidth, barY,
        { color: '#333333', width: 0.25, opacity: 0.7, lineStyle: 'dotted' }
    );

    visual.text(
        `${percent}%`,
        posX + barWidth + 0.2,
        barY + 0.05,
        {
            align: 'left',
            opacity: 1.0,
            color,
            font: '0.7 monospace',
            strokeWidth: 0.08,
            stroke: '#000000',
        }
    );
}

function visualizeSpawns(struct) {
    // visualize spawning
    for (let spawn of struct.spawns) {
        if (!spawn.spawning) continue;
        const spawningCreep = Game.creeps[spawn.spawning.name];

        const remaining = spawn.spawning.remainingTime;
        const total = spawn.spawning.needTime;
        const ratio = (1 - (remaining / total));
        const percent = Math.floor(ratio * 100);

        let color;
        if (ratio < 0.5) {
            // 0-50%: red -> yellow
            const t = ratio / 0.5;
            const r = 255;
            const g = Math.floor(170 * t);
            const b = 0;
            color = `rgb(${r},${g},${b})`;
        } else {
            // 50-100%: yellow -> green
            const t = (ratio - 0.5) / 0.5;
            const r = Math.floor(255 * (1 - t));
            const g = 170 + Math.floor(85 * t);
            const b = 0;
            color = `rgb(${r},${g},${b})`;
        }
        const posX = spawn.pos.x + 1;
        const posY = spawn.pos.y;

        spawn.room.visual.text(
            `♻️ ${spawningCreep.memory.role}`,
            posX,
            posY,
            {
                align: 'left',
                opacity: 1.0,
                color: '#ffffff',
                font: '0.8 monospace',
                stroke: '#000000',
                strokeWidth: 0.08
            }
        );

        // Creep name below
        spawn.room.visual.text(
            spawningCreep.name,
            posX,
            posY + 0.6,
            {
                align: 'left',
                opacity: 1.0,
                color: '#999999',
                font: '0.7 monospace',
                stroke: '#000000',
                strokeWidth: 0.08
            }
        );

        const barWidth = 4;
        const filledWidth = ratio * barWidth;
        const barY = posY + 1.1;
        spawn.room.visual.line(
            { x: posX, y: barY },
            { x: posX + filledWidth, y: barY },
            { color, width: 0.2, opacity: 1.0 }
        );

        spawn.room.visual.line(
            { x: posX + filledWidth, y: barY },
            { x: posX + barWidth, y: barY },
            { color: '#333333', width: 0.2, opacity: 0.7, lineStyle: 'dotted' }
        );

        spawn.room.visual.text(
            `${percent}%`,
            posX + barWidth + 0.2,
            barY + 0.05,
            {
                align: 'left',
                opacity: 1.0,
                color,
                font: '0.7 monospace',
                strokeWidth: 0.08,
                stroke: '#000000'
            }
        );
    }
}

/** visualize CPU usage as a mini line chart
 *  tracks last 50 ticks of CPU used per tick
 * @param {*} room 
 * @returns 
 */
function visualizeCPU(room) {
    // initit tracking
    if (!room.memory.cpuTracking) {
        room.memory.cpuTracking = {
            history: [], // circular buffer: {tick: Game.time, cpu: Game.cpu.getUsed()}
            avg: 0
        };
    }

    const tracking = room.memory.cpuTracking;

    tracking.history.push({
        tick: Game.time,
        cpu: Game.cpu.getUsed()
    });
    if (tracking.history.length > 50) {
        tracking.history.shift();
    }

    if (Game.time % 10 === 0) {
        tracking.avg = tracking.history.reduce((sum, entry) => sum + entry.cpu, 0) / tracking.history.length;
    }

    const visual = room.visual;
    const chartX = 39; // bottom right corner-ish
    const chartY = 48.2;
    const width = 10;
    const height = 0.8;

    visual.rect(chartX, chartY, width, height, {
        fill: '#000000',
        opacity: 0.3,
        stroke: '#333333',
        strokeWidth: 0.05
    });

    if (tracking.history.length < 2) return; // need data

    const data = tracking.history.map(entry => Math.min(entry.cpu, 20));
    const maxCpu = 20;
    const minCpu = 0;

    // polyline points
    const points = [];
    for (let i = 0; i < data.length; i++) {
        const progress = (data[i] - minCpu) / (maxCpu - minCpu);
        const x = chartX + 0.2 + (i / (data.length - 1)) * (width - 0.4);
        const y = chartY + height - (progress * height);
        points.push({ x, y });
    }

    // color interp green->red based on avg
    const avgProgress = Math.min(tracking.avg / maxCpu, 1);
    const r = Math.floor(255 * avgProgress);
    const g = Math.floor(255 * (1 - avgProgress));
    const lineColor = `rgb(${r},${g},0)`;

    if (points.length > 1) {
        visual.poly(points, {
            stroke: lineColor,
            strokeWidth: 0.08,
            opacity: 1.0,
            lineStyle: 'smooth'
        });
    }

    // grid lines
    for (let level of [5, 10, 15]) {
        const y = chartY + height - (level / maxCpu) * height;
        visual.line(chartX + 0.2, y, chartX + width - 0.2, y, {
            color: '#444444',
            width: 0.03,
            opacity: 0.6,
            lineStyle: 'dotted'
        });
    }

    // vertical tick marks (every 10 ticks)
    for (let i = 0; i <= 5; i++) {
        const x = chartX + 0.2 + (i / 5) * (width - 0.4);
        visual.line(x, chartY, x, chartY + height, {
            color: '#444444',
            width: 0.02,
            opacity: 0.4,
            lineStyle: 'dotted'
        });
    }

    // labels
    const currentStr = `${tracking.history[tracking.history.length - 1].cpu.toFixed(1)}ms`;
    const avgStr = `Ø${tracking.avg.toFixed(1)}ms`;
    const cpuBucket = `${Game.cpu.bucket}`;

    visual.text(currentStr, chartX + 0.1, chartY - 0.3, {
        align: 'left',
        opacity: 1.0,
        color: '#ffffff',
        stroke: '#000000',
        strokeWidth: 0.06,
        font: '0.7 monospace'
    });

    visual.text(avgStr, chartX + 4, chartY - 0.3, {
        align: 'center',
        opacity: 1.0,
        color: lineColor,
        stroke: '#000000',
        strokeWidth: 0.06,
        font: '0.7 monospace'
    });

    // bucket warning if low (<200)
    if (Game.cpu.bucket < 200) {
        visual.text('⚠️ Bucket low', chartX + 7.5, chartY - 0.3, {
            opacity: 1.0,
            color: '#ff4444',
            stroke: '#000000',
            strokeWidth: 0.06,
            font: '0.6 monospace'
        });
    } else {
        visual.text(cpuBucket, chartX + 7.5, chartY - 0.3, {
            opacity: 1.0,
            color: '#44beff',
            stroke: '#000000',
            strokeWidth: 0.06,
            font: '0.7 monospace'
        });
    }
}
