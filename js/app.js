const locations = [];
const items = [];
const pokemons = [];
const moves = [];
const inventory = [];

let currentLocation = null;
let northLocation = null;
let eastLocation = null;
let westLocation = null;
let southLocation = null;

const mainSceneEl = document.querySelector('.main-scene');
const itemsListEl = document.querySelector('.items-list');

const centerViewBtn = document.getElementById('center-view');
const northLocationBtn = document.getElementById('north-location');
const eastLocationBtn = document.getElementById('east-location');
const westLocationBtn = document.getElementById('west-location');
const southLocationBtn = document.getElementById('south-location');

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

        currentLocation = findLocationById(1) || locations[0] || null;
        updateCurrentLocation(currentLocation);
    } catch (error) {
        console.error('Error loading map data:', error);
    }
}

function setupStarterInventory() {
    inventory.length = 0;
    const starterPotion = items.find(i => i.id === 1);
    const starterPokeball = items.find(i => i.id === 2);

    if (starterPotion) inventory.push({ ...starterPotion, quantity: 3 });
    if (starterPokeball) inventory.push({ ...starterPokeball, quantity: 5 });

    renderInventory();
}

function renderInventory() {
    if (!itemsListEl) return;
    itemsListEl.innerHTML = '';

    if (inventory.length === 0) {
        itemsListEl.innerHTML = '<p>Inventário vazio.</p>';
        return;
    }

    inventory.forEach(entry => {
        const div = document.createElement('div');
        div.className = 'inventory-item';
        div.innerHTML = `<strong>${entry.name}</strong> x${entry.quantity} — <span>${entry.description}</span>`;
        itemsListEl.appendChild(div);
    });
}

function renderScene() {
    if (!mainSceneEl || !currentLocation) return;
    mainSceneEl.innerHTML = `
        <h2>${currentLocation.name}</h2>
        <p>Pokémon carregados: ${pokemons.length} | Golpes carregados: ${moves.length}</p>
    `;
}

async function loadContent() {
    await Promise.all([
        loadMoves(),
        loadPokemons(),
        loadItems(),
        loadMap()
    ]);
    setupStarterInventory();
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

function updateCurrentLocation(newLocation) {
    if (!newLocation) return;

    currentLocation = newLocation;
    northLocation = findLocationById(currentLocation.north);
    eastLocation = findLocationById(currentLocation.east);
    westLocation = findLocationById(currentLocation.west);
    southLocation = findLocationById(currentLocation.south);

    renderMap();
}

function onLocationButtonClick(direction) {
    switch (direction) {
        case 'north':
            updateCurrentLocation(northLocation);
            break;
        case 'east':
            updateCurrentLocation(eastLocation);
            break;
        case 'west':
            updateCurrentLocation(westLocation);
            break;
        case 'south':
            updateCurrentLocation(southLocation);
            break;
    }
}

northLocationBtn?.addEventListener('click', () => onLocationButtonClick('north'));
eastLocationBtn?.addEventListener('click', () => onLocationButtonClick('east'));
westLocationBtn?.addEventListener('click', () => onLocationButtonClick('west'));
southLocationBtn?.addEventListener('click', () => onLocationButtonClick('south'));

document.addEventListener('DOMContentLoaded', loadContent);