# Redlands WiFi Map

An interactive web application for mapping and analyzing WiFi networks in Redlands (zip codes 92373 and 92374). The application allows authorized users to upload WiFi network data and visualizes network locations, signal strengths, and security information on an interactive map.

## Features

- Interactive map visualization of WiFi networks
- Color-coded markers based on signal strength
- Filtering by encryption type and signal strength
- Statistics display including total networks and open network warnings
- Secure upload functionality (Google authentication required)
- Automatic filtering of networks outside Redlands zip codes

## File Format

The application accepts text files (.txt or .csv) with the following format:
```
MAC,SSID,Encryption,Channel,Signal Strength,Latitude,Longitude
```

## Development

1. Clone the repository
2. Open index.html in a web browser
3. Use the Google Sign-In to authenticate (authorized emails only)
4. Upload WiFi network data files

## Deployment

The application is deployed using GitHub Pages and can be accessed at: [YOUR-GITHUB-USERNAME].github.io/redlands-wifi-project
