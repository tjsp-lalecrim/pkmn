const STORAGE_KEY = 'kanto_adventure_save_v1';

const locations = [];
const items = [];
const pokemons = [];
const moves = [];
const inventory = [];
const playerParty = [];
const seenPokemons = [];
const caughtPokemons = [];

let currentLocation = null;
let northLocation = null;
let eastLocation = null;
let westLocation = null;
let southLocation = null;

let activeBattle = null;
let activeTab = 'map';
let pokedexFilter = 'all';

const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
const battleTabBtn = document.querySelector('.tab-btn[data-tab="battle"]');
const tabPanels = {
    map: document.getElementById('tab-map'),
    party: document.getElementById('tab-party'),
    inventory: document.getElementById('tab-inventory'),
    pokedex: document.getElementById('tab-pokedex'),
    battle: document.getElementById('tab-battle')
};

const mainSceneEl = document.querySelector('.main-scene');
const partyPanelEl = document.querySelector('.party-panel');
const itemsListEl = document.querySelector('.items-list');
const pokedexPanelEl = document.querySelector('.pokedex-panel');
const battleSpritesEl = document.querySelector('.battle-scene .sprites');
const battleMenuEl = document.querySelector('.battle-scene .battle-menu');

const centerViewBtn = document.getElementById('center-view');
const northLocationBtn = document.getElementById('north-location');
const eastLocationBtn = document.getElementById('east-location');
const westLocationBtn = document.getElementById('west-location');
const southLocationBtn = document.getElementById('south-location');

function setActiveTab(tabName) {
    if (!tabPanels[tabName]) return;
    if (tabName === 'battle' && !activeBattle) return;

    activeTab = tabName;

    tabButtons.forEach(btn => {
        const isCurrent = btn.dataset.tab === tabName;
        btn.classList.toggle('is-active', isCurrent);
        btn.setAttribute('aria-selected', String(isCurrent));
    });

    Object.entries(tabPanels).forEach(([key, panel]) => {
        panel?.classList.toggle('is-active', key === tabName);
    });

    if (tabName === 'party') renderPartyTab();
    if (tabName === 'inventory') renderInventory();
    if (tabName === 'pokedex') renderPokedex();
    if (tabName === 'battle' && activeBattle) renderBattle();
}

function updateBattleTabVisibility() {
    if (!battleTabBtn) return;
    battleTabBtn.classList.toggle('is-hidden', !activeBattle);
}

function registerSeenPokemon(speciesId) {
    const id = Number(speciesId);
    if (!id) return false;
    if (!seenPokemons.includes(id)) {
        seenPokemons.push(id);
        return true;
    }
    return false;
}

function registerCaughtPokemon(speciesId) {
    const id = Number(speciesId);
    if (!id) return false;
    registerSeenPokemon(id);
    if (!caughtPokemons.includes(id)) {
        caughtPokemons.push(id);
        return true;
    }
    return false;
}

function syncPokedexWithParty() {
    playerParty.forEach(poke => {
        if (poke && poke.speciesId) {
            registerCaughtPokemon(poke.speciesId);
        }
    });
}

function getLocationAssetUrl(location) {
    if (!location) return '';
    const slug = location.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `assets/locations/${slug}.png`;
}

function getItemAssetUrl(item) {
    if (!item) return '';
    const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `assets/items/${slug}.png`;
}

async function loadMoves() {
    try {
        const response = await fetch('data/moves.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        moves.length = 0;
        moves.push(...data);
    } catch (error) {
        console.error('Error loading moves data:', error);
    }
}

async function loadPokemons() {
    try {
        const response = await fetch('data/pokemons.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        pokemons.length = 0;
        pokemons.push(...data);
    } catch (error) {
        console.error('Error loading pokemons data:', error);
    }
}

async function loadItems() {
    try {
        const response = await fetch('data/items.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        items.length = 0;
        items.push(...data);
    } catch (error) {
        console.error('Error loading items data:', error);
    }
}

async function loadMap() {
    try {
        const response = await fetch('data/world-map.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        locations.length = 0;
        locations.push(...data);
    } catch (error) {
        console.error('Error loading map data:', error);
    }
}

function computeStatsForLevel(base, level) {
    const maxHp = Math.floor((base.baseHp * 2 * level) / 100) + level + 10;
    const attack = Math.floor((base.attack * 2 * level) / 100) + 5;
    const defense = Math.floor((base.defense * 2 * level) / 100) + 5;
    const speed = Math.floor((base.speed * 2 * level) / 100) + 5;
    return { maxHp, attack, defense, speed };
}

function getXpThreshold(level) {
    return level * 25;
}

function createPokemonInstance(speciesId, level = 5) {
    const base = pokemons.find(p => p.id === speciesId) || pokemons[0];
    if (!base) return null;

    const stats = computeStatsForLevel(base, level);
    const pokemonMoves = (base.moves || [1])
        .map(moveId => moves.find(m => m.id === moveId))
        .filter(Boolean)
        .map(m => ({ ...m, currentPp: m.pp || 30 }));

    return {
        speciesId: base.id,
        name: base.name,
        type1: base.type1,
        type2: base.type2,
        sprite: base.sprite || `assets/pokemons/${base.name.toLowerCase()}.png`,
        level,
        xp: 0,
        nextLevelXp: getXpThreshold(level),
        maxHp: stats.maxHp,
        hp: stats.maxHp,
        attack: stats.attack,
        defense: stats.defense,
        speed: stats.speed,
        moves: pokemonMoves
    };
}

function saveGame() {
    if (!currentLocation) return;
    try {
        const payload = {
            currentLocationId: currentLocation.id,
            playerParty,
            inventory,
            seenPokemons,
            caughtPokemons
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
        console.warn('Não foi possível salvar no localStorage:', err);
    }
}

function loadSavedGame() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed.playerParty) || parsed.playerParty.length === 0) return false;

        playerParty.length = 0;
        playerParty.push(...parsed.playerParty);

        inventory.length = 0;
        if (Array.isArray(parsed.inventory)) {
            inventory.push(...parsed.inventory);
        }

        seenPokemons.length = 0;
        if (Array.isArray(parsed.seenPokemons)) {
            seenPokemons.push(...parsed.seenPokemons.map(Number));
        }

        caughtPokemons.length = 0;
        if (Array.isArray(parsed.caughtPokemons)) {
            caughtPokemons.push(...parsed.caughtPokemons.map(Number));
        }

        syncPokedexWithParty();

        const savedLoc = findLocationById(parsed.currentLocationId) || findLocationById(1) || locations[0];
        updateCurrentLocation(savedLoc, false);
        renderPartyTab();
        renderInventory();
        renderPokedex();
        renderScene();
        return true;
    } catch (err) {
        console.warn('Falha ao carregar save:', err);
        return false;
    }
}

function resetGame() {
    localStorage.removeItem(STORAGE_KEY);
    pokedexFilter = 'all';
    setupStarterTeamAndInventory();
    const startLoc = findLocationById(1) || locations[0] || null;
    updateCurrentLocation(startLoc, false);
    setActiveTab('map');
}

function grantExperience(pokemonInst, xpGain) {
    if (!pokemonInst || xpGain <= 0) return '';

    pokemonInst.xp += xpGain;
    let message = ` +${xpGain} XP para ${pokemonInst.name}!`;

    while (pokemonInst.xp >= pokemonInst.nextLevelXp) {
        pokemonInst.xp -= pokemonInst.nextLevelXp;
        pokemonInst.level += 1;
        pokemonInst.nextLevelXp = getXpThreshold(pokemonInst.level);

        const base = pokemons.find(p => p.id === pokemonInst.speciesId) || pokemons[0];
        if (base) {
            const prevMaxHp = pokemonInst.maxHp;
            const nextStats = computeStatsForLevel(base, pokemonInst.level);
            pokemonInst.maxHp = nextStats.maxHp;
            pokemonInst.attack = nextStats.attack;
            pokemonInst.defense = nextStats.defense;
            pokemonInst.speed = nextStats.speed;
            pokemonInst.hp = Math.min(pokemonInst.maxHp, pokemonInst.hp + Math.max(4, pokemonInst.maxHp - prevMaxHp));
        }

        message += ` 🎉 ${pokemonInst.name} subiu para o Nv.${pokemonInst.level}!`;
    }

    return message;
}

function setupStarterTeamAndInventory() {
    playerParty.length = 0;
    seenPokemons.length = 0;
    caughtPokemons.length = 0;

    const starter = createPokemonInstance(1, 5);
    if (starter) {
        playerParty.push(starter);
        registerCaughtPokemon(starter.speciesId);
    }

    inventory.length = 0;
    const starterPotion = items.find(i => i.id === 1);
    const starterPokeball = items.find(i => i.id === 2);
    const starterEther = items.find(i => i.id === 3);

    if (starterPotion) inventory.push({ ...starterPotion, quantity: 3 });
    if (starterPokeball) inventory.push({ ...starterPokeball, quantity: 5 });
    if (starterEther) inventory.push({ ...starterEther, quantity: 2 });

    renderPartyTab();
    renderInventory();
    renderPokedex();
    renderScene();
    saveGame();
}

function useFieldItem(itemId) {
    if (activeBattle) return;

    const entry = inventory.find(i => i.id === itemId && i.quantity > 0);
    if (!entry) return;

    const lead = playerParty[0];
    if (!lead) return;

    if (entry.id === 1) {
        if (lead.hp >= lead.maxHp) return;
        const healed = Math.min(20, lead.maxHp - lead.hp);
        lead.hp += healed;
        entry.quantity -= 1;
    } else if (entry.id === 3) {
        let restoredAny = false;
        lead.moves.forEach(m => {
            if (m.currentPp < m.pp) {
                m.currentPp = Math.min(m.pp, m.currentPp + 10);
                restoredAny = true;
            }
        });
        if (!restoredAny) return;
        entry.quantity -= 1;
    } else {
        return;
    }

    renderInventory();
    renderPartyTab();
    renderScene();
    saveGame();
}

function setLeadPokemon(index) {
    if (activeBattle || index <= 0 || index >= playerParty.length) return;
    const [chosen] = playerParty.splice(index, 1);
    playerParty.unshift(chosen);
    renderPartyTab();
    renderScene();
    saveGame();
}

function setPokedexFilter(filterName) {
    if (!['all', 'seen', 'caught'].includes(filterName)) return;
    pokedexFilter = filterName;
    renderPokedex();
}

function renderPokedex() {
    if (!pokedexPanelEl) return;

    const sortedSpecies = [...pokemons].sort((a, b) => a.id - b.id);
    const totalCount = sortedSpecies.length;
    const seenCount = seenPokemons.length;
    const caughtCount = caughtPokemons.length;

    const filteredSpecies = sortedSpecies.filter(species => {
        const isCaught = caughtPokemons.includes(species.id);
        const isSeen = isCaught || seenPokemons.includes(species.id);

        if (pokedexFilter === 'caught') return isCaught;
        if (pokedexFilter === 'seen') return isSeen;
        return true;
    });

    const filterButtonsHtml = `
        <div class="pokedex-filters" role="group" aria-label="Filtrar Pokédex">
            <button type="button" class="filter-btn ${pokedexFilter === 'all' ? 'is-active' : ''}" data-dex-filter="all">
                Todos (${totalCount})
            </button>
            <button type="button" class="filter-btn ${pokedexFilter === 'seen' ? 'is-active' : ''}" data-dex-filter="seen">
                Vistos (${seenCount})
            </button>
            <button type="button" class="filter-btn ${pokedexFilter === 'caught' ? 'is-active' : ''}" data-dex-filter="caught">
                Capturados (${caughtCount})
            </button>
        </div>
    `;

    const entriesHtml = filteredSpecies.length > 0
        ? filteredSpecies.map(species => {
            const isCaught = caughtPokemons.includes(species.id);
            const isSeen = isCaught || seenPokemons.includes(species.id);
            const formattedId = `#${String(species.id).padStart(3, '0')}`;
            const typesLabel = [species.type1, species.type2].filter(Boolean).join(' / ');
            const spriteUrl = species.sprite || `assets/pokemons/${species.name.toLowerCase()}.png`;

            let statusBadge = '<span class="dex-badge unknown">Não visto</span>';
            if (isCaught) {
                statusBadge = '<span class="dex-badge caught">Capturado</span>';
            } else if (isSeen) {
                statusBadge = '<span class="dex-badge seen">Visto</span>';
            }

            const displayName = isSeen ? species.name : '???';
            const spriteClass = isCaught
                ? 'dex-sprite'
                : isSeen
                    ? 'dex-sprite seen-tint'
                    : 'dex-sprite silhouette';

            return `
                <div class="pokedex-entry ${isCaught ? 'is-caught' : isSeen ? 'is-seen' : 'is-unknown'}">
                    <img class="${spriteClass}" src="${spriteUrl}" alt="${displayName}" onerror="this.style.display='none'">
                    <div class="dex-info">
                        <div class="dex-header">
                            <span class="dex-number">${formattedId}</span>
                            <strong>${displayName}</strong>
                            ${statusBadge}
                        </div>
                        ${isSeen
                            ? `<small class="dex-types">Tipo: ${typesLabel || '—'}</small>`
                            : '<small class="dex-types">Explore as rotas para registrar.</small>'
                        }
                        ${isCaught
                            ? `<small class="dex-stats">Base — HP: ${species.baseHp} • ATK: ${species.attack} • DEF: ${species.defense} • SPD: ${species.speed}</small>`
                            : ''
                        }
                    </div>
                </div>
            `;
        }).join('')
        : '<p class="pokedex-empty">Nenhum Pokémon encontrado para este filtro.</p>';

    pokedexPanelEl.innerHTML = `
        <div class="pokedex-top">
            <h3>Pokédex de Kanto</h3>
            <p class="pokedex-counter">Vistos: <strong>${seenCount}/${totalCount}</strong> • Capturados: <strong>${caughtCount}/${totalCount}</strong></p>
            ${filterButtonsHtml}
        </div>
        <div class="pokedex-list">${entriesHtml}</div>
    `;

    pokedexPanelEl.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => setPokedexFilter(btn.dataset.dexFilter));
    });
}

function renderPartyTab() {
    if (!partyPanelEl) return;

    const cardsHtml = playerParty.map((poke, idx) => {
        const xpPct = Math.min(100, Math.round((poke.xp / poke.nextLevelXp) * 100));
        const hpPct = Math.max(0, Math.min(100, Math.round((poke.hp / poke.maxHp) * 100)));
        const movesText = (poke.moves || []).map(m => `${m.name} (${m.currentPp}/${m.pp})`).join(', ');

        return `
            <div class="party-summary ${idx === 0 ? 'is-lead' : ''}">
                <img class="mini-sprite" src="${poke.sprite}" alt="${poke.name}" onerror="this.style.display='none'">
                <div class="party-details">
                    <p>
                        <strong>${poke.name}</strong> Nv.${poke.level}
                        ${idx === 0 ? '<span class="lead-badge">Líder</span>' : ''}
                    </p>
                    <small>HP: ${poke.hp}/${poke.maxHp}</small>
                    <div class="hp-bar compact-hp"><div class="hp-fill" style="width:${hpPct}%"></div></div>
                    <small>XP: ${poke.xp}/${poke.nextLevelXp}</small>
                    <div class="xp-bar"><div class="xp-fill" style="width:${xpPct}%"></div></div>
                    <small class="moves-meta">Golpes: ${movesText || '—'}</small>
                </div>
                ${idx > 0 && !activeBattle ? `<button class="action-btn small-btn set-lead-btn" data-party-idx="${idx}">Tornar Líder</button>` : ''}
            </div>
        `;
    }).join('');

    partyPanelEl.innerHTML = `
        <h3>Equipe (${playerParty.length}/6)</h3>
        <div class="party-list">${cardsHtml}</div>
    `;

    partyPanelEl.querySelectorAll('.set-lead-btn').forEach(btn => {
        btn.addEventListener('click', () => setLeadPokemon(Number(btn.dataset.partyIdx)));
    });
}

function renderInventory() {
    if (!itemsListEl) return;
    itemsListEl.innerHTML = '<h3>Mochila</h3>';

    if (inventory.length === 0) {
        itemsListEl.innerHTML += '<p>Inventário vazio.</p>';
        return;
    }

    const lead = playerParty[0];

    inventory.forEach(entry => {
        const div = document.createElement('div');
        div.className = 'inventory-item';
        const itemImgUrl = getItemAssetUrl(entry);

        let canUseOutside = false;
        if (!activeBattle && entry.quantity > 0 && lead) {
            if (entry.id === 1 && lead.hp < lead.maxHp) canUseOutside = true;
            if (entry.id === 3 && lead.moves.some(m => m.currentPp < m.pp)) canUseOutside = true;
        }

        div.innerHTML = `
            <img class="item-sprite" src="${itemImgUrl}" alt="${entry.name}" onerror="this.style.display='none'">
            <div class="inventory-info">
                <strong>${entry.name}</strong> x${entry.quantity} — <span>${entry.description}</span>
            </div>
            ${canUseOutside ? `<button class="action-btn small-btn use-field-item-btn" data-item-id="${entry.id}">Usar no Líder</button>` : ''}
        `;
        itemsListEl.appendChild(div);
    });

    itemsListEl.querySelectorAll('.use-field-item-btn').forEach(btn => {
        btn.addEventListener('click', () => useFieldItem(Number(btn.dataset.itemId)));
    });
}

function renderScene() {
    if (!mainSceneEl || !currentLocation) return;

    const lead = playerParty[0];
    const hasWild = Array.isArray(currentLocation.wildPokemons) && currentLocation.wildPokemons.length > 0;
    const locImgUrl = getLocationAssetUrl(currentLocation);
    const xpPct = lead ? Math.min(100, Math.round((lead.xp / lead.nextLevelXp) * 100)) : 0;

    mainSceneEl.innerHTML = `
        <img class="location-banner" src="${locImgUrl}" alt="${currentLocation.name}" onerror="this.style.display='none'">
        <h2>${currentLocation.name}</h2>
        ${lead ? `
            <div class="party-summary is-lead">
                <img class="mini-sprite" src="${lead.sprite}" alt="${lead.name}" onerror="this.style.display='none'">
                <div class="party-details">
                    <p><strong>Líder:</strong> ${lead.name} Nv.${lead.level} — HP: ${lead.hp}/${lead.maxHp}</p>
                    <div class="xp-bar"><div class="xp-fill" style="width:${xpPct}%"></div></div>
                    <small>Equipe: ${playerParty.length}/6 • XP: ${lead.xp}/${lead.nextLevelXp} • Pokédex: ${caughtPokemons.length}/${pokemons.length}</small>
                </div>
            </div>
        ` : ''}
        <div class="scene-actions">
            ${hasWild ? '<button id="explore-btn" class="action-btn">Procurar Pokémon Selvagem</button>' : '<p class="safe-zone-tag">Zona segura</p>'}
            ${playerParty.some(p => p.hp < p.maxHp) ? '<button id="heal-center-btn" class="action-btn">Descansar (Curar Equipe)</button>' : ''}
            <button id="reset-save-btn" class="action-btn flee-btn">Novo Jogo</button>
        </div>
    `;

    document.getElementById('explore-btn')?.addEventListener('click', () => triggerWildEncounter(true));
    document.getElementById('heal-center-btn')?.addEventListener('click', () => {
        playerParty.forEach(p => { p.hp = p.maxHp; });
        renderScene();
        renderPartyTab();
        renderInventory();
        saveGame();
    });
    document.getElementById('reset-save-btn')?.addEventListener('click', resetGame);
}

async function loadContent() {
    await Promise.all([
        loadMoves(),
        loadPokemons(),
        loadItems(),
        loadMap()
    ]);

    const loadedFromSave = loadSavedGame();
    if (!loadedFromSave) {
        setupStarterTeamAndInventory();
        const startLoc = findLocationById(1) || locations[0] || null;
        updateCurrentLocation(startLoc, false);
    }
    updateBattleTabVisibility();
}

function updateDirectionButton(btn, targetLocation) {
    if (!btn) return;

    if (targetLocation) {
        btn.innerText = targetLocation.name;
        btn.dataset.id = targetLocation.id;
        btn.classList.remove('is-empty');
        btn.setAttribute('aria-disabled', 'false');
    } else {
        btn.innerText = '—';
        btn.dataset.id = '';
        btn.classList.add('is-empty');
        btn.setAttribute('aria-disabled', 'true');
    }
}

function renderMap() {
    if (!currentLocation) return;

    centerViewBtn.innerText = currentLocation.name;
    centerViewBtn.dataset.id = currentLocation.id;

    updateDirectionButton(northLocationBtn, northLocation);
    updateDirectionButton(eastLocationBtn, eastLocation);
    updateDirectionButton(westLocationBtn, westLocation);
    updateDirectionButton(southLocationBtn, southLocation);

    renderScene();
}

function findLocationById(id) {
    if (id === null || id === undefined) return null;
    return locations.find(location => location.id === id) || null;
}

function triggerWildEncounter(force = false) {
    if (!currentLocation || activeBattle) return;

    const pool = currentLocation.wildPokemons || [];
    const rate = currentLocation.encounterRate ?? 0;
    if (pool.length === 0) return;

    if (!force && Math.random() > rate) return;

    const lead = playerParty.find(p => p.hp > 0);
    if (!lead) return;

    const randomSpeciesId = pool[Math.floor(Math.random() * pool.length)];
    const wildLevel = Math.max(2, lead.level + Math.floor(Math.random() * 3) - 1);
    const enemy = createPokemonInstance(randomSpeciesId, wildLevel);
    if (!enemy) return;

    registerSeenPokemon(enemy.speciesId);
    renderPokedex();
    saveGame();

    activeBattle = {
        player: lead,
        enemy,
        log: `Um ${enemy.name} selvagem (Nv.${enemy.level}) apareceu!`,
        finished: false
    };

    updateBattleTabVisibility();
    setActiveTab('battle');
    renderBattle();
}

function calculateDamage(attacker, defender, move) {
    if (!move.power || move.power <= 0) return 0;
    const base = (((2 * attacker.level) / 5 + 2) * move.power * (attacker.attack / defender.defense)) / 50 + 2;
    const variance = 0.85 + Math.random() * 0.15;
    return Math.max(1, Math.floor(base * variance));
}

function executeEnemyTurn() {
    if (!activeBattle || activeBattle.finished) return;

    const { player, enemy } = activeBattle;
    const usableMoves = enemy.moves.filter(m => m.currentPp > 0);
    const chosenMove = usableMoves[Math.floor(Math.random() * usableMoves.length)] || enemy.moves[0];

    if (chosenMove.power > 0) {
        const dmg = calculateDamage(enemy, player, chosenMove);
        player.hp = Math.max(0, player.hp - dmg);
        activeBattle.log += ` ${enemy.name} usou ${chosenMove.name} e causou ${dmg} de dano!`;
    } else {
        activeBattle.log += ` ${enemy.name} usou ${chosenMove.name}!`;
    }

    if (player.hp <= 0) {
        activeBattle.log += ` ${player.name} desmaiou! Você recuou para se recuperar.`;
        activeBattle.finished = true;
    }
}

function handlePlayerMove(moveIndex) {
    if (!activeBattle || activeBattle.finished) return;

    const { player, enemy } = activeBattle;
    const move = player.moves[moveIndex];
    if (!move || move.currentPp <= 0) return;

    move.currentPp -= 1;

    if (move.power > 0) {
        const dmg = calculateDamage(player, enemy, move);
        enemy.hp = Math.max(0, enemy.hp - dmg);
        activeBattle.log = `${player.name} usou ${move.name} e causou ${dmg} de dano!`;
    } else {
        activeBattle.log = `${player.name} usou ${move.name}!`;
    }

    if (enemy.hp <= 0) {
        const xpEarned = enemy.level * 14;
        const xpMsg = grantExperience(player, xpEarned);
        activeBattle.log += ` ${enemy.name} selvagem foi derrotado!${xpMsg}`;
        activeBattle.finished = true;
        saveGame();
        renderBattle();
        return;
    }

    executeEnemyTurn();
    saveGame();
    renderBattle();
}

function handleBattleItem(itemId) {
    if (!activeBattle || activeBattle.finished) return;

    const invEntry = inventory.find(i => i.id === itemId && i.quantity > 0);
    if (!invEntry) return;

    const { player, enemy } = activeBattle;
    invEntry.quantity -= 1;

    if (invEntry.type === 'Potion' && invEntry.id === 1) {
        const healed = Math.min(20, player.maxHp - player.hp);
        player.hp += healed;
        activeBattle.log = `Você usou ${invEntry.name} e recuperou ${healed} HP de ${player.name}!`;
        executeEnemyTurn();
    } else if (invEntry.type === 'Pokeball') {
        const hpRatio = (enemy.maxHp - enemy.hp) / enemy.maxHp;
        const catchChance = 0.35 + hpRatio * 0.55;

        if (Math.random() <= catchChance) {
            registerCaughtPokemon(enemy.speciesId);
            activeBattle.log = `Você lançou uma ${invEntry.name} e capturou ${enemy.name}!`;
            if (playerParty.length < 6) {
                playerParty.push(enemy);
            }
            activeBattle.finished = true;
        } else {
            activeBattle.log = `Oh não! ${enemy.name} escapou da ${invEntry.name}!`;
            executeEnemyTurn();
        }
    }

    saveGame();
    renderInventory();
    renderPartyTab();
    renderPokedex();
    renderBattle();
}

function endBattle() {
    if (playerParty.every(p => p.hp <= 0)) {
        playerParty.forEach(p => { p.hp = p.maxHp; });
    }

    activeBattle = null;
    updateBattleTabVisibility();
    setActiveTab('map');
    renderScene();
    renderPartyTab();
    renderInventory();
    renderPokedex();
    saveGame();
}

function renderBattle() {
    if (!activeBattle || !battleSpritesEl || !battleMenuEl) return;

    const { player, enemy, log, finished } = activeBattle;
    const playerHpPct = Math.round((player.hp / player.maxHp) * 100);
    const enemyHpPct = Math.round((enemy.hp / enemy.maxHp) * 100);

    battleSpritesEl.innerHTML = `
        <div class="combatant enemy-box">
            <img class="battle-sprite" src="${enemy.sprite}" alt="${enemy.name}" onerror="this.style.display='none'">
            <div class="combatant-info">
                <h4>${enemy.name} <small>Nv.${enemy.level}</small></h4>
                <div class="hp-bar"><div class="hp-fill" style="width:${enemyHpPct}%"></div></div>
                <span>HP: ${enemy.hp} / ${enemy.maxHp}</span>
            </div>
        </div>
        <div class="combatant player-box">
            <img class="battle-sprite" src="${player.sprite}" alt="${player.name}" onerror="this.style.display='none'">
            <div class="combatant-info">
                <h4>${player.name} <small>Nv.${player.level}</small></h4>
                <div class="hp-bar"><div class="hp-fill" style="width:${playerHpPct}%"></div></div>
                <span>HP: ${player.hp} / ${player.maxHp}</span>
            </div>
        </div>
    `;

    if (finished) {
        battleMenuEl.innerHTML = `
            <p class="battle-log">${log}</p>
            <button id="end-battle-btn" class="action-btn">Voltar ao Mapa</button>
        `;
        document.getElementById('end-battle-btn')?.addEventListener('click', endBattle);
        return;
    }

    const movesHtml = player.moves.map((m, idx) => `
        <button class="action-btn move-btn" data-move-idx="${idx}" ${m.currentPp <= 0 ? 'disabled' : ''}>
            ${m.name} (${m.currentPp}/${m.pp})
        </button>
    `).join('');

    const usableItems = inventory.filter(i => i.quantity > 0 && (i.id === 1 || i.type === 'Pokeball'));
    const itemsHtml = usableItems.map(item => `
        <button class="action-btn item-btn" data-item-id="${item.id}">
            Usar ${item.name} (x${item.quantity})
        </button>
    `).join('');

    battleMenuEl.innerHTML = `
        <p class="battle-log">${log}</p>
        <div class="battle-actions">
            ${movesHtml}
            ${itemsHtml}
            <button id="flee-battle-btn" class="action-btn flee-btn">Fugir</button>
        </div>
    `;

    battleMenuEl.querySelectorAll('.move-btn').forEach(btn => {
        btn.addEventListener('click', () => handlePlayerMove(Number(btn.dataset.moveIdx)));
    });

    battleMenuEl.querySelectorAll('.item-btn').forEach(btn => {
        btn.addEventListener('click', () => handleBattleItem(Number(btn.dataset.itemId)));
    });

    document.getElementById('flee-battle-btn')?.addEventListener('click', () => {
        activeBattle.log = 'Você fugiu com segurança!';
        activeBattle.finished = true;
        renderBattle();
    });
}

function updateCurrentLocation(newLocation, allowEncounter = true) {
    if (!newLocation || activeBattle) return;

    currentLocation = newLocation;
    northLocation = findLocationById(currentLocation.north);
    eastLocation = findLocationById(currentLocation.east);
    westLocation = findLocationById(currentLocation.west);
    southLocation = findLocationById(currentLocation.south);

    renderMap();
    saveGame();

    if (allowEncounter) {
        triggerWildEncounter(false);
    }
}

function onLocationButtonClick(direction) {
    switch (direction) {
        case 'north':
            updateCurrentLocation(northLocation, true);
            break;
        case 'east':
            updateCurrentLocation(eastLocation, true);
            break;
        case 'west':
            updateCurrentLocation(westLocation, true);
            break;
        case 'south':
            updateCurrentLocation(southLocation, true);
            break;
    }
}

tabButtons.forEach(btn => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
});

northLocationBtn?.addEventListener('click', () => onLocationButtonClick('north'));
eastLocationBtn?.addEventListener('click', () => onLocationButtonClick('east'));
westLocationBtn?.addEventListener('click', () => onLocationButtonClick('west'));
southLocationBtn?.addEventListener('click', () => onLocationButtonClick('south'));

document.addEventListener('DOMContentLoaded', loadContent);