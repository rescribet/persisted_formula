/**
 * Persistence class adapted from https://github.com/antoniogarrote/rdfstore-js
 */

/**
 * "perfect" indices for RDF indexing
 *
 * SPOG (?, ?, ?, ?), (s, ?, ?, ?), (s, p, ?, ?), (s, p, o, ?), (s, p, o, g)
 * GP   (?, ?, ?, g), (?, p, ?, g)
 * OGS  (?, ?, o, ?), (?, ?, o, g), (s, ?, o, g)
 * POG  (?, p, ?, ?), (?, p, o, ?), (?, p, o, g)
 * GSP  (s, ?, ?, g), (s, p, ?, g)
 * OS   (s, ?, o, ?)
 *
 * @param configuration['dbName'] Name for the IndexedDB
 */
class PersistentQuadBackend {
  constructor (configuration = {}) {
    this.indexMap = {}
    this.indices = ['S', 'P', 'O', 'G', 'SP', 'SO', 'SG', 'PO', 'PG', 'OG', 'SPO', 'SPG', 'SOG', 'POG', 'SPOG']
    this.componentOrders = {
      S: ['subject', 'predicate', 'object', 'graph'],
      P: ['predicate', 'subject', 'object', 'graph'],
      O: ['object', 'subject', 'predicate', 'graph'],
      G: ['graph', 'subject', 'predicate', 'object'],
      SP: ['subject', 'predicate', 'object', 'graph'],
      SO: ['subject', 'object', 'predicate', 'graph'],
      SG: ['subject', 'graph', 'predicate', 'object'],
      PO: ['predicate', 'object', 'subject', 'graph'],
      PG: ['predicate', 'graph', 'subject', 'object'],
      OG: ['object', 'graph', 'subject', 'predicate'],
      SPO: ['subject', 'predicate', 'object', 'graph'],
      SPG: ['subject', 'predicate', 'graph', 'object'],
      SOG: ['subject', 'object', 'graph', 'predicate'],
      POG: ['predicate', 'object', 'graph', 'subject'],
      SPOG: ['subject', 'predicate', 'object', 'graph']
    }
    this.componentOrdersMap = {}
    this.configuration = configuration
  }

  connect() {
    return new Promise((resolve, reject) => {
      window.jemoeder = this.componentOrders;
      for (const index in this.componentOrders) {
        if (!Object.prototype.hasOwnProperty.call(this.componentOrders, index)) continue
        const indexComponents = this.componentOrders[index]
        const key = indexComponents.slice(0, index.length).sort().join('.')
        this.componentOrdersMap[key] = index
      }

      this.dbName = this.configuration.name || 'rdfstorejs'
      const request = window.indexedDB.open(this.dbName + '_db', 1)
      request.onerror = (event) => {
        reject(new Error('Error opening IndexedDB: ' + event.target.errorCode))
      }
      request.onsuccess = (event) => {
        this.db = event.target.result
        resolve(this)
      }
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        const objectStore = db.createObjectStore(
          this.dbName,
          { keyPath: 'SPOG' }
        )
        this.indices.forEach((index) => {
          if (index !== 'SPOG') {
            objectStore.createIndex(index, index, { unique: false })
          }
        })
      }
    })
  }

  index (quad) {
    this.indices.forEach((index) => {
      quad[index] = this._genMinIndexKey(quad, index)
    })

    const transaction = this.db.transaction([this.dbName], 'readwrite')
    return new Promise((resolve, reject) => {
      transaction.onerror = (event) => {
        reject(new Error(event.target.error.message))
      }
      const objectStore = transaction.objectStore(this.dbName)
      const request = objectStore.add(quad)
      request.onsuccess = resolve
    })
  }

  range (pattern) {
    const objectStore = this.db.transaction([this.dbName]).objectStore(this.dbName)
    const indexKey = this._indexForPattern(pattern)
    const minIndexKeyValue = this._genMinIndexKey(pattern, indexKey)
    const maxIndexKeyValue = this._genMaxIndexKey(pattern, indexKey)
    const keyRange = window.IDBKeyRange.bound(minIndexKeyValue, maxIndexKeyValue, false, false)
    const quads = []
    let cursorSource

    if (indexKey === 'SPOG') {
      cursorSource = objectStore
    } else {
      cursorSource = objectStore.index(indexKey)
    }

    return new Promise((resolve) => {
      cursorSource.openCursor(keyRange).onsuccess = function (event) {
        const cursor = event.target.result
        if (cursor) {
          quads.push(cursor.value)
          cursor.continue()
        } else {
          resolve(quads)
        }
      }
    })
  }

  search (quad) {
    const objectStore = this.db.transaction([this.dbName]).objectStore(this.dbName)
    const indexKey = this._genMinIndexKey(quad, 'SPOG')
    const request = objectStore.get(indexKey)
    return new Promise((resolve, reject) => {
      request.onerror = function (event) {
        reject(new Error(event.target.statusCode))
      }
      request.onsuccess = function (event) {
        resolve(event.target.result !== null)
      }
    })
  }

  remove (quad) {
    const indexKey = this._genMinIndexKey(quad, 'SPOG')
    const request = this.db.transaction([this.dbName], 'readwrite')
      .objectStore(this.dbName)
      .delete(indexKey)
    return new Promise((resolve, reject) => {
      request.onsuccess = function () {
        resolve(true)
      }
      request.onerror = function (event) {
        reject(new Error(event.target.statusCode))
      }
    })
  }

  _genMinIndexKey (quad, index) {
    const indexComponents = this.componentOrders[index]
    return indexComponents.map((component) => {
      if (typeof (quad[component]) === 'string' || quad[component] === null) {
        return '0'
      } else {
        return quad[component]
      }
    }).join('.')
  }

  _genMaxIndexKey (quad, index) {
    const indexComponents = this.componentOrders[index]
    const acum = []
    for (let i = 0; i < indexComponents.length; i++) {
      const component = indexComponents[i]
      const componentValue = quad[component]
      if (typeof (componentValue) === 'string') {
        acum[i] = 'z'
      } else {
        acum[i] = componentValue
      }
    }
    return acum.map(componentValue => '' + componentValue).join('.')
  }

  _indexForPattern (pattern) {
    const indexKey = pattern.indexKey
    const indexKeyString = indexKey.sort().join('.')
    const index = this.componentOrdersMap[indexKeyString]
    if (index === null) {
      throw new Error('Error, cannot find index for indexKey ' + indexKeyString)
    } else {
      return index
    }
  }

  clear (callback) {
    const transaction = this.db.transaction([this.dbName], 'readwrite')
    const request = transaction.objectStore(this.dbName).clear()
    request.onsuccess = function () { callback() }
    request.onerror = function () { callback() }
  }
}



export default PersistentQuadBackend
