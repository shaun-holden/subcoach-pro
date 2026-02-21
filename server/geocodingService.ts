// Geocoding and distance calculation service
// Uses Haversine formula for straight-line distance calculation

interface Coordinates {
  lat: number;
  lng: number;
}

// Calculate distance between two coordinates using Haversine formula
// Returns distance in miles
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Simple geocoding using OpenStreetMap Nominatim (free, no API key required)
// Caches results to minimize API calls
const geocodeCache = new Map<string, Coordinates | null>();

// Rate limiting: Nominatim requires 1 second between requests
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // milliseconds

// Normalize address for geocoding by removing suite/apt/unit numbers
// These details often prevent successful geocoding
function normalizeAddressForGeocoding(address: string): string {
  let normalized = address.trim();
  
  // Remove suite, apartment, unit numbers and similar
  // Patterns: Suite 100, Apt 5, Unit B, #200, Ste 5, etc.
  normalized = normalized.replace(/,?\s*(Suite|Ste|Apt|Apartment|Unit|#)\s*[A-Za-z0-9-]+/gi, '');
  
  // Clean up any double commas or spaces
  normalized = normalized.replace(/\s*,\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim();
  
  // Remove trailing comma if any
  normalized = normalized.replace(/,\s*$/, '');
  
  return normalized;
}

// Validate address before geocoding
function isValidAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  // Address must be at least 5 characters and contain at least one number and letter
  return trimmed.length >= 5 && /\d/.test(trimmed) && /[a-zA-Z]/.test(trimmed);
}

export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  if (!isValidAddress(address)) {
    return null;
  }

  // Normalize address for better geocoding success
  const normalizedAddress = normalizeAddressForGeocoding(address);
  const cacheKey = normalizedAddress.toLowerCase().trim();
  
  // Check cache first
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) || null;
  }

  try {
    // Rate limiting: wait if needed
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    lastRequestTime = Date.now();

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(normalizedAddress)}&limit=1`,
      {
        headers: {
          'User-Agent': 'SubCoachPro/1.0'
        }
      }
    );

    if (!response.ok) {
      console.error(`Geocoding failed for address: ${address}, status: ${response.status}`);
      geocodeCache.set(cacheKey, null);
      return null;
    }

    const data = await response.json();
    
    if (data && data.length > 0) {
      const coords = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
      geocodeCache.set(cacheKey, coords);
      console.log(`Geocoded address: "${address}" (normalized: "${normalizedAddress}") -> ${coords.lat}, ${coords.lng}`);
      return coords;
    }

    console.log(`No results found for address: "${address}" (normalized: "${normalizedAddress}")`);
    geocodeCache.set(cacheKey, null);
    return null;
  } catch (error) {
    console.error('Error geocoding address:', error);
    geocodeCache.set(cacheKey, null);
    return null;
  }
}

// Calculate distance between two addresses
export async function calculateDistanceBetweenAddresses(
  address1: string,
  address2: string
): Promise<number | null> {
  const [coord1, coord2] = await Promise.all([
    geocodeAddress(address1),
    geocodeAddress(address2)
  ]);

  if (!coord1 || !coord2) {
    return null;
  }

  return calculateDistance(coord1, coord2);
}
