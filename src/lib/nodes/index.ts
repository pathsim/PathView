/**
 * Node module entry point
 * Re-exports all node-related functionality and initializes node definitions
 */

// Re-export types
export * from './types';

// Re-export registry (initializes blocks from generated data on import)
export { nodeRegistry } from './registry';

// Re-export defineNode helper
export { defineNode } from './defineNode';

// Re-export generated block config for external use
export { blockConfig, extractedBlocks, uiOverrides } from './generated/blocks';

// Register subsystem nodes after main registry is initialized
import { registerSubsystemNodes } from './subsystem';
registerSubsystemNodes();

// Re-export subsystem definitions
export { SubsystemDefinition, InterfaceDefinition } from './subsystem';
