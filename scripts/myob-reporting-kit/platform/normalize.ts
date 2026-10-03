export class ArtifactValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'ArtifactValidationError'; }
}
