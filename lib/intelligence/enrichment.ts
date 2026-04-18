/**
 * Enrichment Service
 * Provides company data enrichment from email domains.
 * Uses strategy pattern with fallback to mock provider.
 */

import { EnrichmentInput, EnrichmentResult } from "./types";

// =============================================================================
// PROVIDER INTERFACE
// =============================================================================

interface IEnrichmentProvider {
  readonly name: string;
  canHandle(input: EnrichmentInput): boolean;
  enrich(input: EnrichmentInput): Promise<EnrichmentResult>;
}

// =============================================================================
// MOCK PROVIDER (always available)
// =============================================================================

class MockEnrichmentProvider implements IEnrichmentProvider {
  readonly name = "mock";

  canHandle(): boolean {
    return true; // Always available as fallback
  }

  async enrich(input: EnrichmentInput): Promise<EnrichmentResult> {
    const domain = this.extractDomain(input);

    if (!domain) {
      return this.errorResult("No domain available");
    }

    // Simulate some known domains for testing
    const mockData: Record<string, Partial<EnrichmentResult>> = {
      "microsoft.com": {
        companyName: "Microsoft Corporation",
        industry: "Technology",
        employeeCount: "100,000+",
        location: "Redmond, WA, USA",
      },
      "google.com": {
        companyName: "Google LLC",
        industry: "Technology",
        employeeCount: "100,000+",
        location: "Mountain View, CA, USA",
      },
      "apple.com": {
        companyName: "Apple Inc.",
        industry: "Technology",
        employeeCount: "100,000+",
        location: "Cupertino, CA, USA",
      },
      "hepta.no": {
        companyName: "Hepta AS",
        industry: "Software",
        employeeCount: "10-50",
        location: "Oslo, Norway",
      },
    };

    const data = mockData[domain];
    if (data) {
      return {
        success: true,
        companyName: data.companyName ?? null,
        domain,
        industry: data.industry ?? null,
        employeeCount: data.employeeCount ?? null,
        location: data.location ?? null,
        confidence: 50, // Mock data has lower confidence
        provider: this.name,
      };
    }

    // Generate generic mock data for unknown domains
    const companyName = this.domainToCompanyName(domain);
    return {
      success: true,
      companyName,
      domain,
      industry: null,
      employeeCount: null,
      location: null,
      confidence: 20,
      provider: this.name,
    };
  }

  private extractDomain(input: EnrichmentInput): string | null {
    if (input.domain) return input.domain;
    if (input.email) {
      const parts = input.email.split("@");
      return parts.length === 2 ? parts[1].toLowerCase() : null;
    }
    return null;
  }

  private domainToCompanyName(domain: string): string {
    // Convert "acme.com" to "Acme"
    const name = domain.split(".")[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  private errorResult(reason: string): EnrichmentResult {
    return {
      success: false,
      companyName: null,
      domain: null,
      industry: null,
      employeeCount: null,
      location: null,
      confidence: 0,
      provider: this.name,
      raw: { error: reason },
    };
  }
}

// =============================================================================
// CLEARBIT PROVIDER (when API key is available)
// =============================================================================

interface ClearbitCompanyResponse {
  name: string;
  domain: string;
  category?: {
    industry?: string;
    sector?: string;
  };
  metrics?: {
    employees?: number;
    employeesRange?: string;
  };
  location?: string;
  geo?: {
    city?: string;
    state?: string;
    country?: string;
  };
}

class ClearbitEnrichmentProvider implements IEnrichmentProvider {
  readonly name = "clearbit";
  private readonly apiKey: string;
  private readonly baseUrl = "https://company.clearbit.com/v2/companies";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  canHandle(input: EnrichmentInput): boolean {
    return Boolean(input.email || input.domain);
  }

  async enrich(input: EnrichmentInput): Promise<EnrichmentResult> {
    const domain = this.extractDomain(input);

    if (!domain) {
      return this.errorResult("No domain available for lookup");
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/find?domain=${encodeURIComponent(domain)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (response.status === 404) {
        return this.notFoundResult(domain);
      }

      if (!response.ok) {
        return this.errorResult(`Clearbit API error: ${response.status}`);
      }

      const data: ClearbitCompanyResponse = await response.json();

      return {
        success: true,
        companyName: data.name ?? null,
        domain: data.domain ?? domain,
        industry: data.category?.industry ?? null,
        employeeCount: data.metrics?.employeesRange ?? null,
        location: this.formatLocation(data),
        confidence: 90,
        provider: this.name,
        raw: data as unknown as Record<string, unknown>,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return this.errorResult(`Clearbit request failed: ${message}`);
    }
  }

  private extractDomain(input: EnrichmentInput): string | null {
    if (input.domain) return input.domain;
    if (input.email) {
      const parts = input.email.split("@");
      return parts.length === 2 ? parts[1].toLowerCase() : null;
    }
    return null;
  }

  private formatLocation(data: ClearbitCompanyResponse): string | null {
    if (data.location) return data.location;
    if (data.geo) {
      const parts = [data.geo.city, data.geo.state, data.geo.country].filter(Boolean);
      return parts.length > 0 ? parts.join(", ") : null;
    }
    return null;
  }

  private notFoundResult(domain: string): EnrichmentResult {
    return {
      success: false,
      companyName: null,
      domain,
      industry: null,
      employeeCount: null,
      location: null,
      confidence: 0,
      provider: this.name,
      raw: { reason: "Company not found in Clearbit database" },
    };
  }

  private errorResult(reason: string): EnrichmentResult {
    return {
      success: false,
      companyName: null,
      domain: null,
      industry: null,
      employeeCount: null,
      location: null,
      confidence: 0,
      provider: this.name,
      raw: { error: reason },
    };
  }
}

// =============================================================================
// ENRICHMENT SERVICE
// =============================================================================

class EnrichmentService {
  private providers: IEnrichmentProvider[] = [];

  constructor() {
    // Register providers in priority order
    const clearbitKey = process.env.CLEARBIT_API_KEY;
    if (clearbitKey) {
      this.providers.push(new ClearbitEnrichmentProvider(clearbitKey));
    }

    // Mock is always available as fallback
    this.providers.push(new MockEnrichmentProvider());
  }

  /**
   * Enriches a lead with company data.
   * Tries providers in order until one succeeds.
   */
  async enrich(input: EnrichmentInput): Promise<EnrichmentResult> {
    for (const provider of this.providers) {
      if (!provider.canHandle(input)) {
        continue;
      }

      const result = await provider.enrich(input);
      if (result.success) {
        return result;
      }
    }

    // All providers failed, return mock result
    const mockProvider = new MockEnrichmentProvider();
    return mockProvider.enrich(input);
  }

  /**
   * Gets the list of available providers.
   */
  getProviders(): string[] {
    return this.providers.map((p) => p.name);
  }
}

// Singleton instance
let enrichmentServiceInstance: EnrichmentService | null = null;

export function getEnrichmentService(): EnrichmentService {
  if (!enrichmentServiceInstance) {
    enrichmentServiceInstance = new EnrichmentService();
  }
  return enrichmentServiceInstance;
}

/**
 * Helper function to enrich a lead by email.
 */
export async function enrichLead(email: string): Promise<EnrichmentResult> {
  const service = getEnrichmentService();
  return service.enrich({ email });
}

/**
 * Creates an enrichment input from various sources.
 */
export function createEnrichmentInput(options: {
  email?: string;
  domain?: string;
  ipAddress?: string;
}): EnrichmentInput {
  return {
    email: options.email,
    domain: options.domain,
    ipAddress: options.ipAddress,
  };
}
