import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

interface InvestorHeatMapProps {
  contacts: Array<{
    location: string | null;
    email: string;
    name: string;
  }>;
}

const cityCoordinates: Record<string, [number, number]> = {
  "New York": [40.7128, -74.0060],
  "Los Angeles": [34.0522, -118.2437],
  "Chicago": [41.8781, -87.6298],
  "Houston": [29.7604, -95.3698],
  "Phoenix": [33.4484, -112.0740],
  "Philadelphia": [39.9526, -75.1652],
  "San Antonio": [29.4241, -98.4936],
  "San Diego": [32.7157, -117.1611],
  "Dallas": [32.7767, -96.7970],
  "San Jose": [37.3382, -121.8863],
  "Austin": [30.2672, -97.7431],
  "Jacksonville": [30.3322, -81.6557],
  "Fort Worth": [32.7555, -97.3308],
  "Columbus": [39.9612, -82.9988],
  "Charlotte": [35.2271, -80.8431],
  "San Francisco": [37.7749, -122.4194],
  "Indianapolis": [39.7684, -86.1581],
  "Seattle": [47.6062, -122.3321],
  "Denver": [39.7392, -104.9903],
  "Washington DC": [38.9072, -77.0369],
  "Washington": [38.9072, -77.0369],
  "Boston": [42.3601, -71.0589],
  "El Paso": [31.7619, -106.4850],
  "Nashville": [36.1627, -86.7816],
  "Detroit": [42.3314, -83.0458],
  "Oklahoma City": [35.4676, -97.5164],
  "Portland": [45.5152, -122.6784],
  "Las Vegas": [36.1699, -115.1398],
  "Memphis": [35.1495, -90.0490],
  "Louisville": [38.2527, -85.7585],
  "Baltimore": [39.2904, -76.6122],
  "Milwaukee": [43.0389, -87.9065],
  "Albuquerque": [35.0844, -106.6504],
  "Tucson": [32.2226, -110.9747],
  "Fresno": [36.7378, -119.7871],
  "Mesa": [33.4152, -111.8315],
  "Sacramento": [38.5816, -121.4944],
  "Atlanta": [33.7490, -84.3880],
  "Kansas City": [39.0997, -94.5786],
  "Colorado Springs": [38.8339, -104.8214],
  "Omaha": [41.2565, -95.9345],
  "Raleigh": [35.7796, -78.6382],
  "Miami": [25.7617, -80.1918],
  "Long Beach": [33.7701, -118.1937],
  "Virginia Beach": [36.8529, -75.9780],
  "Oakland": [37.8044, -122.2712],
  "Minneapolis": [44.9778, -93.2650],
  "Tulsa": [36.1540, -95.9928],
  "Tampa": [27.9506, -82.4572],
  "Arlington": [32.7357, -97.1081],
  "New Orleans": [29.9511, -90.0715],
  "Wichita": [37.6872, -97.3301],
  "Cleveland": [41.4993, -81.6944],
  "Bakersfield": [35.3733, -119.0187],
  "Aurora": [39.7294, -104.8319],
  "Anaheim": [33.8366, -117.9143],
  "Honolulu": [21.3099, -157.8581],
  "Santa Ana": [33.7455, -117.8677],
  "Riverside": [33.9806, -117.3755],
  "Corpus Christi": [27.8006, -97.3964],
  "Lexington": [38.0406, -84.5037],
  "Henderson": [36.0397, -114.9817],
  "Stockton": [37.9577, -121.2908],
  "Saint Paul": [44.9537, -93.0900],
  "Cincinnati": [39.1031, -84.5120],
  "St. Louis": [38.6270, -90.1994],
  "Pittsburgh": [40.4406, -79.9959],
  "Greensboro": [36.0726, -79.7920],
  "Lincoln": [40.8136, -96.7026],
  "Anchorage": [61.2181, -149.9003],
  "Plano": [33.0198, -96.6989],
  "Orlando": [28.5383, -81.3792],
  "Irvine": [33.6846, -117.8265],
  "Newark": [40.7357, -74.1724],
  "Durham": [35.9940, -78.8986],
  "Chula Vista": [32.6401, -117.0842],
  "Toledo": [41.6528, -83.5379],
  "Fort Wayne": [41.0793, -85.1394],
  "St. Petersburg": [27.7676, -82.6403],
  "Laredo": [27.5036, -99.5075],
  "Jersey City": [40.7282, -74.0776],
  "Chandler": [33.3062, -111.8413],
  "Madison": [43.0731, -89.4012],
  "Lubbock": [33.5779, -101.8552],
  "Scottsdale": [33.4942, -111.9261],
  "Reno": [39.5296, -119.8138],
  "Buffalo": [42.8864, -78.8784],
  "Gilbert": [33.3528, -111.7890],
  "Glendale": [33.5387, -112.1860],
  "North Las Vegas": [36.1989, -115.1175],
  "Winston-Salem": [36.0999, -80.2442],
  "Chesapeake": [36.7682, -76.2875],
  "Norfolk": [36.8508, -76.2859],
  "Fremont": [37.5483, -121.9886],
  "Garland": [32.9127, -96.6389],
  "Irving": [32.8140, -96.9489],
  "Hialeah": [25.8576, -80.2781],
  "Richmond": [37.5407, -77.4360],
  "Boise": [43.6150, -116.2023],
  "Spokane": [47.6588, -117.4260],
  "Baton Rouge": [30.4515, -91.1871],
  "London": [51.5074, -0.1278],
  "Paris": [48.8566, 2.3522],
  "Tokyo": [35.6762, 139.6503],
  "Sydney": [-33.8688, 151.2093],
  "Toronto": [43.6532, -79.3832],
  "Berlin": [52.5200, 13.4050],
  "Munich": [48.1351, 11.5820],
  "Barcelona": [41.3851, 2.1734],
  "Madrid": [40.4168, -3.7038],
  "Rome": [41.9028, 12.4964],
  "Amsterdam": [52.3676, 4.9041],
  "Brussels": [50.8503, 4.3517],
  "Vienna": [48.2082, 16.3738],
  "Prague": [50.0755, 14.4378],
  "Copenhagen": [55.6761, 12.5683],
  "Stockholm": [59.3293, 18.0686],
  "Oslo": [59.9139, 10.7522],
  "Helsinki": [60.1699, 24.9384],
  "Dublin": [53.3498, -6.2603],
  "Edinburgh": [55.9533, -3.1883],
  "Manchester": [53.4808, -2.2426],
  "Singapore": [1.3521, 103.8198],
  "Hong Kong": [22.3193, 114.1694],
  "Shanghai": [31.2304, 121.4737],
  "Beijing": [39.9042, 116.4074],
  "Seoul": [37.5665, 126.9780],
  "Mumbai": [19.0760, 72.8777],
  "Delhi": [28.6139, 77.2090],
  "Bangalore": [12.9716, 77.5946],
  "Dubai": [25.2048, 55.2708],
  "Tel Aviv": [32.0853, 34.7818],
  "São Paulo": [-23.5505, -46.6333],
  "Rio de Janeiro": [-22.9068, -43.1729],
  "Buenos Aires": [-34.6037, -58.3816],
  "Mexico City": [19.4326, -99.1332],
  "Cape Town": [-33.9249, 18.4241],
  "Johannesburg": [-26.2041, 28.0473],
  "Cairo": [30.0444, 31.2357],
  "Lagos": [6.5244, 3.3792],
  "Nairobi": [-1.2921, 36.8219],
  "Montreal": [45.5017, -73.5673],
  "Vancouver": [49.2827, -123.1207],
  "Calgary": [51.0447, -114.0719],
  "Ottawa": [45.4215, -75.6972],
  "Edmonton": [53.5461, -113.4938],
  "Winnipeg": [49.8951, -97.1384],
  "Quebec City": [46.8139, -71.2080],
  "Halifax": [44.6488, -63.5752],
  "Melbourne": [-37.8136, 144.9631],
  "Brisbane": [-27.4698, 153.0251],
  "Perth": [-31.9505, 115.8605],
  "Adelaide": [-34.9285, 138.6007],
  "Auckland": [-36.8485, 174.7633],
  "Wellington": [-41.2865, 174.7762],
  "United States": [39.8283, -98.5795],
  "USA": [39.8283, -98.5795],
  "Canada": [56.1304, -106.3468],
  "United Kingdom": [55.3781, -3.4360],
  "UK": [55.3781, -3.4360],
  "Germany": [51.1657, 10.4515],
  "France": [46.2276, 2.2137],
  "Italy": [41.8719, 12.5674],
  "Spain": [40.4637, -3.7492],
  "Australia": [-25.2744, 133.7751],
  "Japan": [36.2048, 138.2529],
  "China": [35.8617, 104.1954],
  "India": [20.5937, 78.9629],
  "Brazil": [-14.2350, -51.9253],
  "South Africa": [-30.5595, 22.9375],
  "Mexico": [23.6345, -102.5528],
  "Argentina": [-38.4161, -63.6167],
  "Unknown": [0, 0]
};

function LocationMarkers({ contacts }: { contacts: InvestorHeatMapProps['contacts'] }) {
  const locationData: Array<{ location: string; coords: [number, number]; count: number; investors: string[] }> = [];
  const locationMap: Record<string, { count: number; investors: string[] }> = {};

  // Group contacts by location
  contacts.forEach(contact => {
    if (contact.location && contact.location !== "Unknown") {
      const location = contact.location.trim();
      if (!locationMap[location]) {
        locationMap[location] = { count: 0, investors: [] };
      }
      locationMap[location].count++;
      locationMap[location].investors.push(contact.name || contact.email);
    }
  });

  // Convert to coordinates
  Object.entries(locationMap).forEach(([location, data]) => {
    const normalizedLocation = location
      .split(',')[0]
      .trim()
      .replace(/^(City of |Greater |Metro )/i, '');

    let coords = cityCoordinates[normalizedLocation];

    if (!coords) {
      const partialMatch = Object.keys(cityCoordinates).find(city =>
        city.toLowerCase().includes(normalizedLocation.toLowerCase()) ||
        normalizedLocation.toLowerCase().includes(city.toLowerCase())
      );
      if (partialMatch) {
        coords = cityCoordinates[partialMatch];
      }
    }

    if (coords) {
      locationData.push({
        location,
        coords,
        count: data.count,
        investors: data.investors.slice(0, 5) // Show first 5 investors
      });
    }
  });

  // Calculate max count for scaling
  const maxCount = Math.max(...locationData.map(d => d.count), 1);

  return (
    <>
      {locationData.map((data, index) => {
        // Scale radius based on count (min 8px, max 25px)
        const radius = Math.max(8, Math.min(25, 8 + (data.count / maxCount) * 17));

        return (
          <CircleMarker
            key={`${data.location}-${index}`}
            center={data.coords}
            radius={radius}
            pathOptions={{
              fillColor: '#dc2626',  // Red color
              color: 'transparent',   // No border
              weight: 0,
              opacity: 0,
              fillOpacity: 0.5        // 50% opacity
            }}
          >
            <Popup>
              <div className="font-sans">
                <p className="font-bold text-sm mb-1">{data.location}</p>
                <p className="text-xs text-gray-600 mb-2">
                  {data.count} investor{data.count !== 1 ? 's' : ''}
                </p>
                <div className="text-xs">
                  {data.investors.map((name, i) => (
                    <div key={i} className="truncate max-w-[200px]">
                      • {name}
                    </div>
                  ))}
                  {data.count > 5 && (
                    <div className="text-gray-500 italic">
                      and {data.count - 5} more...
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

export function InvestorHeatMap({ contacts }: InvestorHeatMapProps) {
  const mapRef = useRef<L.Map | null>(null);

  const validContacts = contacts.filter(c => c.location && c.location !== "Unknown");
  const locationCounts: Record<string, number> = {};

  validContacts.forEach(contact => {
    if (contact.location) {
      const location = contact.location.trim();
      locationCounts[location] = (locationCounts[location] || 0) + 1;
    }
  });

  const topLocations = Object.entries(locationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-0">
      <div className="lg:col-span-3">
        <div style={{ height: '400px', position: 'relative' }}>
          <MapContainer
            center={[39.8283, -98.5795]}
            zoom={4}
            style={{ height: '100%', width: '100%', background: '#f5f5f5' }}
            ref={mapRef}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            <LocationMarkers contacts={validContacts} />
          </MapContainer>
        </div>
      </div>

      <div className="p-4 bg-gradient-to-b from-gray-50 to-white border-l">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Top Locations</h3>
        <div className="space-y-2">
          {topLocations.map(([location, count], index) => (
            <div key={location} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500 w-4">
                  {index + 1}.
                </span>
                <span className="text-sm text-gray-700 truncate max-w-[140px]">
                  {location}
                </span>
              </div>
              <span className="text-sm font-semibold text-indigo-600">
                {count}
              </span>
            </div>
          ))}
          {topLocations.length === 0 && (
            <p className="text-sm text-gray-500">No location data available</p>
          )}
        </div>

        <div className="mt-4 pt-4 border-t">
          <div className="space-y-1">
            <p className="text-xs text-gray-600">
              <span className="font-semibold">Total Investors:</span> {contacts.length}
            </p>
            <p className="text-xs text-gray-600">
              <span className="font-semibold">With Location:</span> {validContacts.length}
            </p>
            <p className="text-xs text-gray-600">
              <span className="font-semibold">Unique Locations:</span> {Object.keys(locationCounts).length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}