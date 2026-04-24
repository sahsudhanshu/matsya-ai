/**
 * Component Cache with LRU (Least Recently Used) Eviction Policy
 * 
 * Implements a cache for preserving component state when switching between
 * components in the Content Canvas. Uses LRU eviction when max capacity is reached.
 * 
 * Requirements: 23.4
 */

import type { ComponentType, CachedComponent } from '@/types/agent-first';

export class ComponentCache {
  private maxSize: number;
  private entries: Map<ComponentType, CachedComponent>;

  constructor(maxSize: number = 3) {
    this.maxSize = maxSize;
    this.entries = new Map();
  }

  /**
   * Retrieves a cached component and updates its access time (LRU)
   * @param type - The component type to retrieve
   * @returns The cached component or null if not found
   */
  get(type: ComponentType): CachedComponent | null {
    if (type === null) return null;
    
    const cached = this.entries.get(type);
    if (!cached) return null;

    // Update timestamp to mark as recently used (LRU)
    const updated: CachedComponent = {
      ...cached,
      timestamp: Date.now()
    };
    
    // Re-insert to move to end of Map (most recent)
    this.entries.delete(type);
    this.entries.set(type, updated);

    return updated;
  }

  /**
   * Stores a component in the cache, evicting LRU entry if at capacity
   * @param type - The component type to cache
   * @param data - The component data to cache
   */
  set(type: ComponentType, data: CachedComponent): void {
    if (type === null) return;

    // If component already exists, remove it first (will be re-added at end)
    if (this.entries.has(type)) {
      this.entries.delete(type);
    }

    // Evict oldest entry if at capacity
    if (this.entries.size >= this.maxSize) {
      this.evict();
    }

    // Add new entry with current timestamp
    this.entries.set(type, {
      ...data,
      timestamp: Date.now()
    });
  }

  /**
   * Evicts the least recently used entry from the cache
   */
  evict(): void {
    // Map maintains insertion order, so first entry is the oldest
    const firstKey = this.entries.keys().next().value;
    if (firstKey !== undefined) {
      this.entries.delete(firstKey);
    }
  }

  /**
   * Clears all entries from the cache
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Returns the current size of the cache
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Checks if a component type is cached
   */
  has(type: ComponentType): boolean {
    if (type === null) return false;
    return this.entries.has(type);
  }

  /**
   * Returns all cached component types
   */
  keys(): ComponentType[] {
    return Array.from(this.entries.keys());
  }
}
