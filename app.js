// Initialize the map centered on Redlands
const map = L.map('map').setView([34.0556, -117.1825], 13);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Define zip code boundaries (approximate)
const zipCodes = {
    '92373': {
        north: 34.0700,
        south: 34.0200,
        east: -117.1400,
        west: -117.1825
    },
    '92374': {
        north: 34.0900,
        south: 34.0300,
        east: -117.1400,
        west: -117.2300
    }
};

// Function to check if coordinates are within specified zip codes
function isInRedlandsZipCodes(lat, lon) {
    console.log('Checking coordinates:', lat, lon);
    // Check each zip code area
    for (const [zipCode, bounds] of Object.entries(zipCodes)) {
        const isInBounds = lat >= bounds.south &&
                          lat <= bounds.north &&
                          lon >= bounds.west &&
                          lon <= bounds.east;
        
        console.log(`Checking ${zipCode}:`, {
            latInRange: `${bounds.south} <= ${lat} <= ${bounds.north}`,
            lonInRange: `${bounds.west} <= ${lon} <= ${bounds.east}`,
            isInBounds
        });
        
        if (isInBounds) return true;
    }
    return false;
}

// Set bounds to Redlands area (92373 and 92374)
const southWest = L.latLng(34.0200, -117.2200);
const northEast = L.latLng(34.0900, -117.1400);
const bounds = L.latLngBounds(southWest, northEast);
map.setMaxBounds(bounds);

// Initialize variables to store data
let wifiNetworks = [];
let markers = L.layerGroup().addTo(map);

// Function to determine marker color based on signal strength
function getMarkerColor(signal) {
    if (signal >= -70) return '#00ff00';  // Strong signal: green
    if (signal >= -80) return '#ffff00';  // Medium signal: yellow
    return '#ff0000';  // Weak signal: red
}

// Function to create marker popup content
function createPopupContent(network) {
    return `
        <strong>SSID:</strong> ${network.ssid}<br>
        <strong>MAC:</strong> ${network.mac}<br>
        <strong>Auth Mode:</strong> ${network.encryption}<br>
        <strong>First Seen:</strong> ${network.firstSeen}<br>
        <strong>Channel:</strong> ${network.channel}<br>
        <strong>Signal:</strong> ${network.signal} dBm<br>
        <strong>Location:</strong> ${network.lat.toFixed(6)}, ${network.lon.toFixed(6)}<br>
        <strong>Altitude:</strong> ${network.altitude.toFixed(2)}m<br>
        <strong>Accuracy:</strong> ${network.accuracy.toFixed(2)}m<br>
        <strong>Type:</strong> ${network.type}
    `;
}

// Function to update statistics
function updateStats() {
    const totalNetworks = wifiNetworks.length;
    const openNetworks = wifiNetworks.filter(n => n.encryption.toLowerCase() === 'open').length;
    const avgSignal = wifiNetworks.length > 0 
        ? Math.round(wifiNetworks.reduce((sum, n) => sum + parseFloat(n.signal), 0) / totalNetworks) 
        : 'N/A';

    // Update warning message for open networks
    const warningElement = document.getElementById('openNetworksWarning');
    if (openNetworks === 0) {
        warningElement.textContent = 'No open networks detected';
        warningElement.parentElement.style.background = '#d4edda';
        warningElement.parentElement.style.color = '#155724';
        warningElement.parentElement.style.borderColor = '#c3e6cb';
    } else {
        warningElement.textContent = `⚠️ WARNING: ${openNetworks} unsecured ${openNetworks === 1 ? 'network' : 'networks'} detected in the area!`;
        warningElement.parentElement.style.background = '#fff3cd';
        warningElement.parentElement.style.color = '#856404';
        warningElement.parentElement.style.borderColor = '#ffeeba';
    }

    document.getElementById('totalNetworks').textContent = totalNetworks;
    document.getElementById('openNetworks').textContent = openNetworks;
    document.getElementById('avgSignal').textContent = avgSignal !== 'N/A' ? `${avgSignal} dBm` : 'N/A';
}

// Function to apply filters and update map
function applyFilters() {
    const encryptionFilter = document.getElementById('encryptionFilter').value;
    const signalFilter = parseInt(document.getElementById('signalFilter').value);

    markers.clearLayers();

    wifiNetworks.forEach(network => {
        if (encryptionFilter !== 'all' && network.encryption !== encryptionFilter) return;
        if (!isNaN(signalFilter) && parseFloat(network.signal) < signalFilter) return;

        const marker = L.circleMarker([network.lat, network.lon], {
            radius: 8,
            fillColor: getMarkerColor(parseFloat(network.signal)),
            color: '#000',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        });

        marker.bindPopup(createPopupContent(network));
        markers.addLayer(marker);
    });
}

// Load networks from Firebase on page load
async function loadNetworksFromFirebase() {
    try {
        const snapshot = await db.collection('networks').get();
        const networks = [];
        snapshot.forEach(doc => {
            networks.push(doc.data());
        });
        
        if (networks.length > 0) {
            wifiNetworks = networks;
            updateStats();
            applyFilters();
            
            // Center map on the first network
            map.setView([networks[0].lat, networks[0].lon], 13);
        }
    } catch (error) {
        console.error('Error loading networks from Firebase:', error);
    }
}

// Call the load function when the page loads
loadNetworksFromFirebase();

// Handle file upload
document.getElementById('fileInput').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        try {
            // Split into lines and remove empty lines
            const lines = text.split('\n').filter(line => line.trim());
            
            // Skip header line and process each line
            const allNetworks = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                const parts = line.split(',');
                
                // Basic validation
                if (parts.length === 11) {
                    const network = {
                        mac: parts[0].trim(),
                        ssid: parts[1].trim() || '(Hidden Network)',
                        encryption: parts[2].replace(/[\[\]]/g, '').trim(),
                        firstSeen: parts[3].trim(),
                        channel: Number(parts[4]),
                        signal: Number(parts[5]),
                        lat: Number(parts[6]),
                        lon: Number(parts[7]),
                        altitude: Number(parts[8]),
                        accuracy: Number(parts[9]),
                        type: parts[10].trim(),
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    allNetworks.push(network);
                }
            }

            // Filter networks to only those in Redlands zip codes
            const filteredNetworks = allNetworks.filter(network => 
                isInRedlandsZipCodes(network.lat, network.lon)
            );

            if (filteredNetworks.length === 0) {
                alert('No valid networks found within Redlands zip codes (92373 and 92374).');
                return;
            }

            // Save networks to Firebase
            try {
                console.log('Starting to save networks to Firebase...');
                const batch = db.batch();
                filteredNetworks.forEach((network, index) => {
                    console.log(`Processing network ${index + 1}/${filteredNetworks.length}:`, network);
                    const networkRef = db.collection('networks').doc();
                    batch.set(networkRef, network);
                });
                console.log('Committing batch to Firebase...');
                await batch.commit();
                console.log('Successfully saved networks to Firebase');

                // Add new networks to existing ones instead of replacing
                wifiNetworks = [...wifiNetworks, ...filteredNetworks];
                updateStats();
                applyFilters();
                
                // Only center map on first network if this is the first upload
                if (wifiNetworks.length === filteredNetworks.length) {
                    map.setView([filteredNetworks[0].lat, filteredNetworks[0].lon], 13);
                }
            } catch (error) {
                console.error('Error saving to Firebase:', error);
                console.error('Error details:', {
                    code: error.code,
                    message: error.message,
                    stack: error.stack
                });
                alert('Error saving networks to database. Please check the console for details.');
                return;
            }
        } catch (error) {
            console.error('Error processing file:', error);
            alert('Error processing file. Please check the format and try again.');
        }
    };

    reader.readAsText(file);
});

// Add filter change listeners
document.getElementById('encryptionFilter').addEventListener('change', applyFilters);
document.getElementById('signalFilter').addEventListener('change', applyFilters); 