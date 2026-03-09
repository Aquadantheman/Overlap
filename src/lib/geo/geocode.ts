// Geocode US zip codes to lat/lng coordinates
// Uses the free Zippopotam.us API (no key required)

export type GeoResult = {
  lat: number
  lng: number
  city: string
  state: string
} | null

export async function geocodeZip(zipCode: string): Promise<GeoResult> {
  // Validate zip format
  if (!/^\d{5}$/.test(zipCode)) {
    return null
  }

  try {
    const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`)

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    if (!data.places || data.places.length === 0) {
      return null
    }

    const place = data.places[0]
    return {
      lat: parseFloat(place.latitude),
      lng: parseFloat(place.longitude),
      city: place["place name"],
      state: place["state abbreviation"],
    }
  } catch {
    return null
  }
}
