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

// Handle file upload
document.getElementById('fileInput').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        try {
            // Normalize line endings and split
            const lines = text
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n')
                .split('\n')
                .filter(line => line.trim());

            console.log('Total lines:', lines.length);
            
            // Skip header line
            const dataLines = lines.slice(1);
            const allNetworks = [];

            for (const line of dataLines) {
                // Debug output for each line
                console.log('-------------------');
                console.log('Raw line:', line);
                console.log('Line length:', line.length);
                console.log('Line bytes:', Array.from(line).map(c => c.charCodeAt(0)));
                
                // Split and trim each part
                const parts = line.split(',').map(part => part.trim());
                console.log('Parts:', parts);
                console.log('Number of parts:', parts.length);

                // Validate parts
                if (parts.length !== 11) {
                    console.error('Invalid number of fields:', parts.length);
                    continue;
                }

                const [mac, ssid, authMode, firstSeen, channel, rssi, lat, lon, altitude, accuracy, type] = parts;

                try {
                    // Create network object with validation
                    const network = {
                        mac: mac,
                        ssid: ssid || '(Hidden Network)',
                        encryption: authMode.replace(/[\[\]]/g, ''),
                        firstSeen,
                        channel,
                        signal: Number(rssi),
                        lat: Number(lat),
                        lon: Number(lon),
                        altitude: Number(altitude),
                        accuracy: Number(accuracy),
                        type
                    };

                    // Validate all numeric fields
                    if (Object.entries(network).some(([key, value]) => 
                        ['signal', 'lat', 'lon', 'altitude', 'accuracy'].includes(key) && 
                        (isNaN(value) || !isFinite(value)))) {
                        console.error('Invalid numeric value in:', network);
                        continue;
                    }

                    allNetworks.push(network);
                    console.log('Successfully parsed network:', network);
                } catch (err) {
                    console.error('Error parsing network:', err);
                    continue;
                }
            }

            console.log('Valid networks found:', allNetworks.length);

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
            alert('Error processing file. Please check the format and try again.');
        }
    };

    reader.readAsText(file);
});

// Add filter change listeners
document.getElementById('encryptionFilter').addEventListener('change', applyFilters);
document.getElementById('signalFilter').addEventListener('change', applyFilters); 