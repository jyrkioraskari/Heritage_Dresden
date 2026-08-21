/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1645766414")

  // update collection data
  unmarshal({
    "name": "bldg_photographs"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1645766414")

  // update collection data
  unmarshal({
    "name": "bldg_photograph"
  }, collection)

  return app.save(collection)
})
