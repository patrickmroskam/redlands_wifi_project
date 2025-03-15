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
        south: 34.0400,
        east: -117.1400,
        west: -117.2200
    }
};

// Function to check if coordinates are within specified zip codes
function isInRedlandsZipCodes(lat, lon) {
    // Check each zip code area
    return Object.values(zipCodes).some(bounds => {
        return lat >= bounds.south &&
               lat <= bounds.north &&
               lon >= bounds.west &&
               lon <= bounds.east;
    });
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
        <strong>Encryption:</strong> ${network.encryption}<br>
        <strong>Channel:</strong> ${network.channel}<br>
        <strong>Signal:</strong> ${network.signal} dBm<br>
        <strong>Location:</strong> ${network.lat.toFixed(6)}, ${network.lon.toFixed(6)}
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

// Handle file upload
document.getElementById('fileInput').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        try {
            const allNetworks = text.split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const parts = line.split(',').map(s => s.trim());
                    if (parts.length !== 7) {
                        console.error('Invalid line format:', line);
                        return null;
                    }
                    const [mac, ssid, encryption, channel, signal, lat, lon] = parts;
                    const parsedLat = parseFloat(lat);
                    const parsedLon = parseFloat(lon);
                    
                    if (isNaN(parsedLat) || isNaN(parsedLon)) {
                        console.error('Invalid coordinates:', lat, lon);
                        return null;
                    }

                    return {
                        mac,
                        ssid,
                        encryption,
                        channel,
                        signal: parseFloat(signal),
                        lat: parsedLat,
                        lon: parsedLon
                    };
                })
                .filter(network => network !== null); // Remove invalid entries

            // Filter networks to only those in Redlands zip codes
            const filteredNetworks = allNetworks.filter(network => {
                const inZipCodes = isInRedlandsZipCodes(network.lat, network.lon);
                if (!inZipCodes) {
                    console.log(`Filtered out network ${network.ssid} at ${network.lat}, ${network.lon} - outside Redlands zip codes`);
                }
                return inZipCodes;
            });

            if (filteredNetworks.length === 0) {
                alert('No valid networks found within Redlands zip codes (92373 and 92374). Please check your data format and coordinates.');
                return;
            }

            if (filteredNetworks.length < allNetworks.length) {
                alert(`Filtered out ${allNetworks.length - filteredNetworks.length} networks outside of Redlands zip codes (92373 and 92374)`);
            }

            wifiNetworks = filteredNetworks;
            updateStats();
            applyFilters();
            
            // Center map on the first valid network
            if (filteredNetworks.length > 0) {
                map.setView([filteredNetworks[0].lat, filteredNetworks[0].lon], 13);
            }
        } catch (error) {
            console.error('Error processing file:', error);
            alert('Error processing file. Please check the format: MAC,SSID,Encryption,Channel,Signal Strength,Latitude,Longitude');
        }
    };

    reader.readAsText(file);
});

// Add filter change listeners
document.getElementById('encryptionFilter').addEventListener('change', applyFilters);
document.getElementById('signalFilter').addEventListener('change', applyFilters); 