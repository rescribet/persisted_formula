# Persisted formula

Store and load information from 
[rdflib.js formulae](https://github.com/linkeddata/rdflib.js/) (stores/graphs)
to indexedDB storage in the browser.

## Usage
Persisting data:
```ecmascript 6
import { persist } from 'persisted_formula'
const store = $rdf.graph()
// Write some data into the store
persist(store)
// The data is now stored in indexedDB
```
Loading data:
```ecmascript 6
import { load } from 'persisted_formula'
const store = $rdf.Graph()
load(store)
// The data is now loaded into the store (if any data was present)
```
Accessing the raw API:
````ecmascript 6
import PersistentQuadBackend from 'persisted_formula'

const toBeRemoved = [/* Some quads that need deletion */]
new PersistentQuadBackend()
  .connect()
  .then(backend => {
    toBeRemoved.forEach(q => backend.remove(q))
  })
````
