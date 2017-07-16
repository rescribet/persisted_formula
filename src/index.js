/* global $rdf */
import PersistentQuadBackend from './persistent_quad_backend.js'

function convertNode(node) {
  switch(node.termType) {
    case 'NamedNode':
      return new $rdf.NamedNode(node.value)
    case 'Literal':
      return new $rdf.Node(node.value)
    case 'BlankNode':
      return new $rdf.BlankNode(node.value)
    case 'collection':
      return new $rdf.Collection(node.elements);
    default:
      return undefined
  }
}

function convertQuad (quad) {
  return new $rdf.Statement(
    convertNode(quad.subject),
    convertNode(quad.predicate),
    convertNode(quad.object),
    convertNode(quad.why)
  )
}

/**
 * Loads the contents of stored quads into a formula
 */
export function load(formula) {
  return new PersistentQuadBackend()
    .connect()
    .then(backend => backend.range({indexKey: backend.componentOrders.S}))
    .then(quads => {
      const convertedQuads = quads.map(convertQuad)
      Promise.resolve(formula.addAll(convertedQuads))
    })
}

/**
 * Saves a formula into indexedDB
 */
export function persist(formula) {
  return new PersistentQuadBackend()
    .connect()
    .then(backend => formula.statements.forEach(q => backend.index(q)))
}

export default PersistentQuadBackend
