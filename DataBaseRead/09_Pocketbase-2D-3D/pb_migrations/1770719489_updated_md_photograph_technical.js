/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2961477348")

  // update collection data
  unmarshal({
    "name": "md_photograph"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2961477348")

  // update collection data
  unmarshal({
    "name": "md_photograph_technical"
  }, collection)

  return app.save(collection)
})
