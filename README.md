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

The application is deployed and accessible at https://redlandswifiproject.com

### Custom Domain Setup

1. Configure your domain DNS settings to point to GitHub Pages:
   - Type: A Record
   - Name: @
   - Value: GitHub Pages IP addresses
     ```
     185.199.108.153
     185.199.109.153
     185.199.110.153
     185.199.111.153
     ```
   - Also add AAAA records for IPv6 support

2. Configure Google OAuth:
   - Add these URLs to Authorized JavaScript origins:
     ```
     https://redlandswifiproject.com
     http://redlandswifiproject.com
     ```

3. Ensure HTTPS is enabled in GitHub Pages settings for secure authentication
