class LRUCache {
  constructor() {
    this.store = new Map();
  }

  get(key) {
    return this.store.get(key);
  }

  set(key, value) {
    this.store.set(key, value);
    return true;
  }

  has(key) {
    return this.store.has(key);
  }

  clear() {
    this.store.clear();
  }

  delete(key) {
    return this.store.delete(key);
  }
}

module.exports = {
  LRUCache,
  default: LRUCache
};


