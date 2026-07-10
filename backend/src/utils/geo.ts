// No import needed: Using native global fetch (available in Node.js 18+)

const DEV_COUNTRIES = ["United States", "India", "United Kingdom", "Germany", "Canada", "Singapore", "Australia", "France"];

/**
 * Resolves the country of an IP address.
 * Gracefully handles errors and dev environments.
 */
export async function getCountryFromIp(ip: string): Promise<string> {
  const cleanIp = ip.trim();

  // Handle localhost / internal IPs during development
  if (
    cleanIp === "::1" ||
    cleanIp === "127.0.0.1" ||
    cleanIp.startsWith("192.168.") ||
    cleanIp.startsWith("10.") ||
    cleanIp.startsWith("127.") ||
    cleanIp.startsWith("::ffff:127.")
  ) {
    const randomIndex = Math.floor(Math.random() * DEV_COUNTRIES.length);
    return DEV_COUNTRIES[randomIndex];
  }

  try {
    // Call ip-api.com with a 2-second timeout to prevent blocking
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,country`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data: any = await response.json();
      if (data && data.status === "success" && data.country) {
        return data.country;
      }
    }
  } catch (error) {
    console.warn(`Geolocation failed for IP ${cleanIp}:`, error instanceof Error ? error.message : error);
  }

  return "Unknown";
}
