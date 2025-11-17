// ---------------------------------------------------------------
// 1. base → controller transfer
// 2. source → base transfer when source is full
// ---------------------------------------------------------------

module.exports = {
    run: run
};

/**
 * @param {Room} room
 * @param {Object} struct
 */
function run(room, struct) {
    if (!room.controller || !room.controller.my) return;

    const ids = room.memory.struct_ids;

    const linkBase = ids.link_base_id ? Game.getObjectById(ids.link_base_id) : null;
    const linkCtrl = ids.link_controller_id ? Game.getObjectById(ids.link_controller_id) : null;

    // cache
    if (!linkBase || !linkCtrl) {
        const base = struct.main_spawn.pos.findClosestByRange(struct.links);
        const ctrl = room.controller.pos.findClosestByRange(struct.links);
        if (base && ctrl && base.id !== ctrl.id) {
            ids.link_base_id = base.id;
            ids.link_controller_id = ctrl.id;
        }
        return;
    }

    // 1. base → controller logic
    if (room.memory.link_avail_ug && linkBase.cooldown === 0) {
        if (linkCtrl.store.getFreeCapacity(RESOURCE_ENERGY) >
            linkCtrl.store.getCapacity(RESOURCE_ENERGY) * 0.5) {
            linkBase.transferEnergy(linkCtrl); // transfer if controller link less than 50%
        }
    }

    // 2. link-mining: source → base when source is full
    if (!room.memory.link_avail_mine) return;

    for (let i = 0; i < struct.links_by_source.length; i++) {
        const srcLink = struct.links_by_source[i];
        if (!srcLink || srcLink.cooldown > 0) continue;

        // transfer only when the source link is almost full
        const energy = srcLink.store[RESOURCE_ENERGY];
        if (energy < LINK_CAPACITY * 0.95) continue;

        const dest = linkBase.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            ? linkBase
            : null;

        if (dest) srcLink.transferEnergy(dest);
    }
}