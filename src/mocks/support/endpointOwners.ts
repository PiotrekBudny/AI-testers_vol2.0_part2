import type { ApiEndpoint } from '@/api/endpoints';

export class EndpointOwners {
  private readonly owners = new Map<ApiEndpoint, string>();

  claim(owner: string, endpoints: ApiEndpoint[]): void {
    for (const endpoint of endpoints) {
      const current = this.owners.get(endpoint);
      if (current !== undefined && current !== owner) {
        throw new Error(
          `${owner} and ${current} both serve ${endpoint}, each from its own data. Request only one of them in a test.`,
        );
      }
      this.owners.set(endpoint, owner);
    }
  }
}
