/** Reject polling reads that overlap any mutation, including reads started during a save. */
export class AgendaSync {
  private version = 0
  private pending = 0

  capture(): number | null { return this.pending ? null : this.version }
  canApply(version: number | null): boolean { return version !== null && !this.pending && version === this.version }

  async mutate<T>(operation: () => Promise<T>): Promise<T> {
    this.version += 1
    this.pending += 1
    try { return await operation() }
    finally { this.version += 1; this.pending -= 1 }
  }
}
