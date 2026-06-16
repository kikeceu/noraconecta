export interface ReverseGeocodeResult {
  departmentName: string | null;
  neighborhood: string | null;
  postalCode: string | null;
  raw: unknown;
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NoraConecta/1.0 (contacto@noraconecta.com)',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { departmentName: null, neighborhood: null, postalCode: null, raw: { status: response.status } };
    }

    const data = (await response.json()) as {
      address?: {
        county?: string;
        city?: string;
        town?: string;
        suburb?: string;
        neighbourhood?: string;
        postcode?: string;
      };
    };

    const address = data.address || {};
    const departmentName = address.county || address.city || address.town || null;
    const neighborhood = address.suburb || address.neighbourhood || null;
    const postalCode = address.postcode || null;

    return { departmentName, neighborhood, postalCode, raw: data };
  } catch (err) {
    clearTimeout(timeout);
    return { departmentName: null, neighborhood: null, postalCode: null, raw: err };
  }
}
